// 주간 이메일 발송 작업. 예약 실행(/api/cron/weekly-email)이 부른다.
// DB 클라이언트(service role)와 발송 함수를 받아 쓰므로 테스트에서 가짜 발송기로 바꿔 끼울 수 있다 (test:weekly-email).
// 여러 번 실행돼도(재시도·중복·보충 실행) 같은 부모에게 같은 주 메일이 두 번 가지 않게 한다 (D-022).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.ts";
import { toKstDateKey, weekStartOf } from "./date.ts";
import { stageAt, type LifeStage } from "./life-stage.ts";
import { buildUnsubscribeUrl } from "./unsubscribe.ts";
import {
  buildWeeklyEmail,
  decideDelivery,
  idempotencyKey,
  isEligible,
  weeklySendTime,
  type EmailSender,
} from "./weekly-email.ts";

type Db = SupabaseClient<Database>;

export type WeeklyEmailSummary = {
  /** 이번 주(KST 월요일) */
  weekStart: string;
  /** "ok" 외에는 아무것도 보내지 않은 이유 */
  status: "ok" | "too_early" | "no_question";
  eligible: number;
  sent: number;
  failed: number;
  skippedAlreadyWrote: number;
  skippedDone: number;
  skippedExhausted: number;
  skippedInProgress: number;
  /** 자녀의 시기(유년·아동 등)에 맞는 이번 주 질문이 아직 없어서 보내지 않은 부모 (D-038) */
  skippedNoStageQuestion: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runWeeklyEmailJob(options: {
  db: Db;
  sender: EmailSender;
  /** 끝 슬래시 없는 앱 주소 */
  appUrl: string;
  /** 수신 거부 링크 서명 키 (운영에서는 CRON_SECRET, D-024) */
  unsubscribeSecret: string;
  now?: Date;
  /** 발송 사이 간격(ms). Resend 한도를 확인하지 못해 기본 600ms. */
  sendIntervalMs?: number;
}): Promise<WeeklyEmailSummary> {
  const { db, sender, appUrl, unsubscribeSecret } = options;
  const now = options.now ?? new Date();
  const interval = options.sendIntervalMs ?? 600;

  const weekStart = weekStartOf(toKstDateKey(now.toISOString()));
  const sendAt = weeklySendTime(weekStart);
  const summary: WeeklyEmailSummary = {
    weekStart,
    status: "ok",
    eligible: 0,
    sent: 0,
    failed: 0,
    skippedAlreadyWrote: 0,
    skippedDone: 0,
    skippedExhausted: 0,
    skippedInProgress: 0,
    skippedNoStageQuestion: 0,
  };

  // 월요일 발송 시각 전에는 보내지 않는다 (수동 호출 방지).
  if (now.getTime() < sendAt.getTime()) return { ...summary, status: "too_early" };

  // 같은 주에도 시기별 질문이 따로 있다. 부모마다 자녀의 시기에 맞는 질문을 보낸다 (D-038).
  const { data: weekQuestions, error: questionError } = await db
    .from("weekly_questions")
    .select("id, stage, body, hint")
    .eq("week_start", weekStart);
  if (questionError) throw new Error(`question_query_${questionError.code}`);
  if (weekQuestions.length === 0) return { ...summary, status: "no_question" };
  const questionByStage = new Map<LifeStage, (typeof weekQuestions)[number]>(
    weekQuestions.map((row) => [row.stage, row]),
  );
  const questionIds = weekQuestions.map((row) => row.id);

  // 동의한 부모 → 자녀가 있는 부모 → 대상
  const { data: consenting, error: settingsError } = await db
    .from("parent_settings")
    .select("user_id, email_consent, consent_updated_at")
    .eq("email_consent", true)
    .lte("consent_updated_at", sendAt.toISOString());
  if (settingsError) throw new Error(`settings_query_${settingsError.code}`);
  if (consenting.length === 0) return summary;

  const consentingIds = consenting.map((row) => row.user_id);
  const [children, entries, deliveries] = await Promise.all([
    db.from("children").select("user_id, birth_date").in("user_id", consentingIds),
    db.from("entries").select("user_id, weekly_question_id").in("weekly_question_id", questionIds).in("user_id", consentingIds),
    db
      .from("email_deliveries")
      .select("id, user_id, weekly_question_id, status, attempts, last_attempt_at")
      .in("weekly_question_id", questionIds)
      .in("user_id", consentingIds),
  ]);
  if (children.error) throw new Error(`children_query_${children.error.code}`);
  if (entries.error) throw new Error(`entries_query_${entries.error.code}`);
  if (deliveries.error) throw new Error(`deliveries_query_${deliveries.error.code}`);

  const birthDateByUser = new Map(children.data.map((row) => [row.user_id, row.birth_date]));
  // 시기별 질문 행이 달라도 같은 주에 썼거나 이미 보낸 부모는 다시 안내하지 않는다 (D-039).
  const wroteUsers = new Set(entries.data.map((row) => row.user_id));
  const deliveryByUser = new Map<string, (typeof deliveries.data)[number]>();
  const priority = { sent: 4, skipped: 3, processing: 2, failed: 1 };
  for (const row of deliveries.data) {
    const current = deliveryByUser.get(row.user_id);
    if (!current || priority[row.status] > priority[current.status]) deliveryByUser.set(row.user_id, row);
  }

  let firstSend = true;
  for (const setting of consenting) {
    const userId = setting.user_id;
    if (
      !isEligible({
        emailConsent: setting.email_consent,
        consentUpdatedAt: setting.consent_updated_at,
        hasChild: birthDateByUser.has(userId),
        sendAt,
      })
    ) {
      continue;
    }
    summary.eligible += 1;

    const existing = deliveryByUser.get(userId) ?? null;
    // 재시도도 원래 발송 행을 이어 쓴다. 생년월일 수정으로 시기가 달라져도 별도의 메일을 만들지 않는다.
    const question = existing
      ? weekQuestions.find((row) => row.id === existing.weekly_question_id)
      : questionByStage.get(stageAt(birthDateByUser.get(userId)!, weekStart));
    if (!question) {
      summary.skippedNoStageQuestion += 1;
      continue;
    }
    const wroteThisWeek = wroteUsers.has(userId);
    const decision = decideDelivery(
      existing && {
        status: existing.status,
        attempts: existing.attempts,
        lastAttemptAt: existing.last_attempt_at,
      },
      now,
    );
    if (decision.action === "skip") {
      if (decision.reason === "done") summary.skippedDone += 1;
      else if (decision.reason === "exhausted") summary.skippedExhausted += 1;
      else summary.skippedInProgress += 1;
      continue;
    }

    // 이미 이번 주 기록을 남겼으면 보내지 않고 기록만 남긴다.
    if (wroteThisWeek && !existing) {
      const { error } = await db.from("email_deliveries").insert({
        user_id: userId,
        weekly_question_id: question.id,
        status: "skipped",
      });
      if (error && error.code !== "23505") throw new Error(`delivery_insert_${error.code}`);
      summary.skippedAlreadyWrote += 1;
      continue;
    }
    if (wroteThisWeek) {
      summary.skippedAlreadyWrote += 1;
      continue;
    }

    // 점유: 유니크 행을 먼저 만든 쪽(또는 조건부 갱신에 성공한 쪽)만 보낸다.
    const claimedAt = now.toISOString();
    if (!existing) {
      const { error } = await db.from("email_deliveries").insert({
        user_id: userId,
        weekly_question_id: question.id,
        status: "processing",
        attempts: 1,
        first_attempt_at: claimedAt,
        last_attempt_at: claimedAt,
      });
      if (error) {
        if (error.code === "23505") {
          summary.skippedInProgress += 1; // 동시에 실행된 다른 작업이 먼저 점유
          continue;
        }
        throw new Error(`delivery_insert_${error.code}`);
      }
    } else {
      const { data: claimed, error } = await db
        .from("email_deliveries")
        .update({ status: "processing", attempts: decision.attempt, last_attempt_at: claimedAt })
        .eq("id", existing.id)
        .eq("status", existing.status)
        .eq("attempts", existing.attempts)
        .select("id");
      if (error) throw new Error(`delivery_claim_${error.code}`);
      if (claimed.length !== 1) {
        summary.skippedInProgress += 1;
        continue;
      }
    }

    // 수신 주소는 보낼 때만 읽고 로그·DB에 남기지 않는다.
    const { data: authUser, error: userError } = await db.auth.admin.getUserById(userId);
    const to = userError ? null : authUser.user?.email;

    let result: { ok: true; id: string | null } | { ok: false; code: string };
    if (!to) {
      result = { ok: false, code: "no_email" };
    } else {
      if (!firstSend && interval > 0) await sleep(interval);
      firstSend = false;
      // 수신 거부 링크는 부모별 서명이라 메일을 부모마다 만든다.
      const mail = buildWeeklyEmail({
        questionBody: question.body,
        hint: question.hint,
        appUrl,
        unsubscribeUrl: buildUnsubscribeUrl(appUrl, userId, unsubscribeSecret),
      });
      result = await sender({
        to,
        ...mail,
        idempotencyKey: idempotencyKey(question.id, userId, decision.attempt),
      });
    }

    const finishedAt = new Date().toISOString();
    const { error: finishError } = await db
      .from("email_deliveries")
      .update(
        result.ok
          ? { status: "sent", sent_at: finishedAt, last_attempt_at: finishedAt, error_code: null }
          : { status: "failed", last_attempt_at: finishedAt, error_code: result.code },
      )
      .eq("user_id", userId)
      .eq("weekly_question_id", question.id);
    if (finishError) console.error("[weekly-email] 결과 기록 실패", finishError.code);

    if (result.ok) summary.sent += 1;
    else {
      summary.failed += 1;
      console.error("[weekly-email] 발송 실패", result.code);
    }
  }

  return summary;
}
