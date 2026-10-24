// 주간 이메일 발송 작업 검증 (SESSION 07). 실행: npm run test:weekly-email
// runWeeklyEmailJob()을 실제 개발 DB + 가짜 발송기로 실행한다 (실제 메일은 보내지 않는다).
// 개발용 프로젝트에만 실행한다. 임시 사용자·임시 질문(2020년·2099년 월요일)을 만들고 끝나면 지운다 (service role 키 사용).
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runWeeklyEmailJob } from "../../src/lib/weekly-email-job.ts";
import type { EmailMessage, SendResult } from "../../src/lib/weekly-email.ts";
import type { Database } from "../../src/types/database";

type Db = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publishableKey || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY 가 필요하다 (.env.local).");
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service: Db = createClient<Database>(url, serviceKey, clientOptions);
const APP_URL = "https://example.test";

type TestUser = { id: string; email: string; client: Db; childId: string | null };

async function createTestUser(
  label: string,
  opts: { consent: boolean; child: boolean },
): Promise<TestUser> {
  const email = `weekly-test-${label}-${randomBytes(6).toString("hex")}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  assert.ok(created.data.user);
  const id = created.data.user.id;
  const client: Db = createClient<Database>(url!, publishableKey!, clientOptions);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);

  // 앱처럼 사용자 세션 클라이언트로 수신 설정·자녀를 만든다.
  const settings = await client.from("parent_settings").insert({ user_id: id, email_consent: opts.consent });
  assert.ifError(settings.error);
  let childId: string | null = null;
  if (opts.child) {
    const child = await client
      .from("children")
      .insert({ user_id: id, nickname: label, birth_date: "2022-05-14" })
      .select("id")
      .single();
    assert.ifError(child.error);
    childId = child.data!.id;
  }
  return { id, email, client, childId };
}

describe("주간 이메일 발송 작업 (실제 DB + 가짜 발송기)", () => {
  const questionIds: string[] = [];
  const userIds: string[] = [];
  const questionByWeek = new Map<string, string>();
  const sent: EmailMessage[] = [];
  const calls = new Map<string, number>(); // 주소별 발송 시도 횟수 (성공·실패 모두)
  const failMode = new Map<string, "once" | "always">(); // 주소별 실패 방식

  let A: TestUser, B: TestUser, C: TestUser, D: TestUser, E: TestUser, F: TestUser;

  // 가짜 발송기: 테스트 주소는 기록·실패 방식 적용, 그 밖(실제 부모 계정)은 아무것도 하지 않고 성공 처리
  async function fakeSender(message: EmailMessage): Promise<SendResult> {
    if (!message.to.startsWith("weekly-test-")) return { ok: true, id: null };
    calls.set(message.to, (calls.get(message.to) ?? 0) + 1);
    const mode = failMode.get(message.to);
    if (mode === "always" || (mode === "once" && calls.get(message.to) === 1)) {
      return { ok: false, code: "resend_500" };
    }
    sent.push(message);
    return { ok: true, id: "fake" };
  }

  const run = (nowIso: string) =>
    runWeeklyEmailJob({ db: service, sender: fakeSender, appUrl: APP_URL, now: new Date(nowIso), sendIntervalMs: 0 });
  const sentTo = (user: TestUser) => sent.filter((m) => m.to === user.email);
  const delivery = async (user: TestUser, week: string) => {
    const { data, error } = await service
      .from("email_deliveries")
      .select("status, attempts, error_code, sent_at")
      .eq("user_id", user.id)
      .eq("weekly_question_id", questionByWeek.get(week)!);
    assert.ifError(error);
    return data![0] ?? null;
  };

  const WEEK = "2099-01-05"; // 월요일
  const WEEK_CONCURRENT = "2099-01-12";
  const WEEK_PAST = "2020-01-06";

  before(async () => {
    for (const week of [WEEK, WEEK_CONCURRENT, WEEK_PAST]) {
      const q = await service
        .from("weekly_questions")
        .insert({ week_start: week, body: `[weekly-test] 질문 ${week}`, hint: "힌트" })
        .select("id")
        .single();
      assert.ifError(q.error);
      questionIds.push(q.data!.id);
      questionByWeek.set(week, q.data!.id);
    }
    A = await createTestUser("a-ok", { consent: true, child: true });
    B = await createTestUser("b-no-consent", { consent: false, child: true });
    C = await createTestUser("c-no-child", { consent: true, child: false });
    D = await createTestUser("d-wrote", { consent: true, child: true });
    E = await createTestUser("e-fail-once", { consent: true, child: true });
    F = await createTestUser("f-fail-always", { consent: true, child: true });
    userIds.push(A.id, B.id, C.id, D.id, E.id, F.id);
    failMode.set(E.email, "once");
    failMode.set(F.email, "always");

    const entry = await D.client
      .from("entries")
      .insert({ user_id: D.id, child_id: D.childId!, weekly_question_id: questionByWeek.get(WEEK)!, body: "이미 썼어요" });
    assert.ifError(entry.error);
  });

  after(async () => {
    // 사용자 삭제가 자녀·기록·설정·발송 기록을 연쇄 삭제한다. 그 뒤 임시 질문을 지운다.
    for (const id of userIds) await service.auth.admin.deleteUser(id);
    await service.from("email_deliveries").delete().in("weekly_question_id", questionIds);
    await service.from("weekly_questions").delete().in("id", questionIds);
  });

  it("발송 시각 전(월요일 10:00 KST)에는 아무것도 보내지 않는다", async () => {
    const summary = await run(`${WEEK}T10:00:00+09:00`);
    assert.equal(summary.status, "too_early");
    assert.equal(sent.length, 0);
    assert.equal(await delivery(A, WEEK), null);
  });

  it("질문이 없는 주에는 보내지 않는다", async () => {
    const summary = await run("2099-01-19T20:00:00+09:00");
    assert.equal(summary.status, "no_question");
    assert.equal(sent.length, 0);
  });

  it("동의+자녀 있는 부모에게만 보낸다. 동의 안 함·자녀 없음·이미 기록함은 보내지 않는다", async () => {
    await run(`${WEEK}T20:00:00+09:00`);

    assert.equal(sentTo(A).length, 1);
    const mail = sentTo(A)[0];
    assert.ok(mail.text.includes(`[weekly-test] 질문 ${WEEK}`));
    assert.ok(mail.text.includes(`${APP_URL}/write`));
    assert.ok(mail.idempotencyKey.startsWith(`weekly/${questionByWeek.get(WEEK)}/${A.id}/`));
    assert.equal((await delivery(A, WEEK))?.status, "sent");
    assert.equal((await delivery(A, WEEK))?.attempts, 1);

    assert.equal(sentTo(B).length, 0);
    assert.equal(sentTo(C).length, 0);
    assert.equal(await delivery(B, WEEK), null);
    assert.equal(await delivery(C, WEEK), null);

    assert.equal(sentTo(D).length, 0);
    assert.equal((await delivery(D, WEEK))?.status, "skipped");
  });

  it("발송 실패는 failed로 남고 오류 코드만 기록된다", async () => {
    const row = await delivery(E, WEEK);
    assert.equal(row?.status, "failed");
    assert.equal(row?.attempts, 1);
    assert.equal(row?.error_code, "resend_500");
    assert.equal(row?.sent_at, null);
  });

  it("같은 주에 다시 실행해도 보낸 부모에게 중복 발송하지 않고, 실패분만 재시도한다 (보충 실행)", async () => {
    const summary = await run(`${WEEK}T20:30:00+09:00`);
    assert.equal(sentTo(A).length, 1);
    assert.equal(sentTo(D).length, 0);
    assert.equal(sentTo(E).length, 1);
    const row = await delivery(E, WEEK);
    assert.equal(row?.status, "sent");
    assert.equal(row?.attempts, 2);
    assert.equal(row?.error_code, null);
    assert.ok(summary.skippedDone >= 1);

    await run(`${WEEK}T21:00:00+09:00`);
    assert.equal(sentTo(A).length, 1);
    assert.equal(sentTo(E).length, 1);
  });

  it("계속 실패하면 최대 3회까지만 시도한다", async () => {
    // 위 실행들로 F는 1·2·3번째 시도를 이미 했다(실행 3회). 한 번 더 실행해도 늘지 않는다.
    assert.equal(calls.get(F.email), 3);
    const row = await delivery(F, WEEK);
    assert.equal(row?.status, "failed");
    assert.equal(row?.attempts, 3);

    const summary = await run(`${WEEK}T21:30:00+09:00`);
    assert.equal(calls.get(F.email), 3);
    assert.ok(summary.skippedExhausted >= 1);
  });

  it("동시에 두 번 실행돼도 같은 부모에게 한 통만 간다", async () => {
    const before = sent.length;
    await Promise.all([
      run(`${WEEK_CONCURRENT}T20:00:00+09:00`),
      run(`${WEEK_CONCURRENT}T20:00:00+09:00`),
    ]);
    const mails = sent.slice(before).filter((m) => m.to === A.email);
    assert.equal(mails.length, 1);
    const { data } = await service
      .from("email_deliveries")
      .select("id")
      .eq("user_id", A.id)
      .eq("weekly_question_id", questionByWeek.get(WEEK_CONCURRENT)!);
    assert.equal(data!.length, 1);
  });

  it("그 주 발송 시각 이후에 동의한 부모는 받지 않는다 (다음 주부터)", async () => {
    // 임시 사용자들의 동의 시각(지금)은 2020년 발송 시각보다 늦다.
    const summary = await run(`${WEEK_PAST}T20:00:00+09:00`);
    assert.equal(summary.status, "ok");
    assert.equal(sent.filter((m) => m.text.includes(WEEK_PAST)).length, 0);
    assert.equal(await delivery(A, WEEK_PAST), null);
  });
});

describe("수신 동의 저장 (사용자 세션, 앱과 같은 쿼리)", () => {
  let user: TestUser;
  before(async () => {
    user = await createTestUser("consent", { consent: false, child: false });
  });
  after(async () => {
    await service.auth.admin.deleteUser(user.id);
  });

  it("동의를 바꾸면 consent_updated_at이 갱신되고, 같은 값 저장은 유지한다", async () => {
    const read = async () => {
      const { data, error } = await user.client
        .from("parent_settings")
        .select("email_consent, consent_updated_at")
        .eq("user_id", user.id)
        .single();
      assert.ifError(error);
      return data!;
    };
    const first = await read();
    assert.equal(first.email_consent, false);

    await new Promise((resolve) => setTimeout(resolve, 20));
    const on = await user.client.from("parent_settings").update({ email_consent: true }).eq("user_id", user.id).select("user_id");
    assert.ifError(on.error);
    assert.equal(on.data!.length, 1);
    const second = await read();
    assert.equal(second.email_consent, true);
    assert.ok(new Date(second.consent_updated_at) > new Date(first.consent_updated_at));

    await user.client.from("parent_settings").update({ email_consent: true }).eq("user_id", user.id);
    assert.equal((await read()).consent_updated_at, second.consent_updated_at);
  });

  it("consent_updated_at은 클라이언트가 직접 바꿀 수 없다", async () => {
    const result = await user.client
      .from("parent_settings")
      .update({ consent_updated_at: "2000-01-01T00:00:00Z" } as never)
      .eq("user_id", user.id);
    assert.ok(result.error, "컬럼 GRANT가 막아야 한다");
  });
});
