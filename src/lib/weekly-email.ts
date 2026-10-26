// 주간 질문 이메일의 순수 규칙 (발송 시각·대상·재시도 판단·본문). Next.js에 묶이지 않는 순수 TS (D-015).
// 확정 정책은 D-022. 실제 DB 조회·발송은 weekly-email-job.ts가 한다.

/** 발송 시각(한국 시간, 월요일). 바꾸려면 이 값과 vercel.json의 cron을 함께 바꾼다 (UTC = KST − 9시간). */
export const WEEKLY_EMAIL_SEND_HOUR_KST = 19;
export const MAX_ATTEMPTS = 3;
/** `processing`으로 이만큼 지난 행은 작업이 중단된 것으로 본다. */
export const STALE_PROCESSING_MS = 15 * 60 * 1000;

/** 그 주(월요일 `weekStart`, KST)의 발송 시각 */
export function weeklySendTime(weekStart: string): Date {
  const hour = String(WEEKLY_EMAIL_SEND_HOUR_KST).padStart(2, "0");
  return new Date(`${weekStart}T${hour}:00:00+09:00`);
}

export type DeliveryRow = {
  status: "processing" | "sent" | "failed" | "skipped";
  attempts: number;
  lastAttemptAt: string | null;
};

export type DeliveryDecision =
  | { action: "send"; attempt: number }
  | { action: "skip"; reason: "done" | "exhausted" | "in_progress" };

/** 이미 있는 발송 기록을 보고 이번 실행에서 보낼지 정한다 (멱등·보정형). */
export function decideDelivery(existing: DeliveryRow | null, now: Date): DeliveryDecision {
  if (!existing) return { action: "send", attempt: 1 };
  if (existing.status === "sent" || existing.status === "skipped") {
    return { action: "skip", reason: "done" };
  }
  if (existing.status === "processing") {
    const last = existing.lastAttemptAt ? new Date(existing.lastAttemptAt).getTime() : 0;
    if (now.getTime() - last < STALE_PROCESSING_MS) {
      return { action: "skip", reason: "in_progress" };
    }
  }
  // failed 이거나 중단된 processing
  if (existing.attempts >= MAX_ATTEMPTS) return { action: "skip", reason: "exhausted" };
  return { action: "send", attempt: existing.attempts + 1 };
}

/**
 * 이번 주 발송 대상인지. 동의했고 자녀가 있어야 하며,
 * 동의가 이번 주 발송 시각 이전이어야 한다(그 이후 가입·동의한 부모는 다음 주부터).
 */
export function isEligible(input: {
  emailConsent: boolean;
  consentUpdatedAt: string;
  hasChild: boolean;
  sendAt: Date;
}): boolean {
  return (
    input.emailConsent &&
    input.hasChild &&
    new Date(input.consentUpdatedAt).getTime() <= input.sendAt.getTime()
  );
}

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** 같은 요청의 중복 발송 방지(Resend Idempotency-Key) */
  idempotencyKey: string;
  /** 추가 메일 헤더 (예: List-Unsubscribe) */
  headers?: Record<string, string>;
};

/** ok:false의 code는 로그·DB에 남겨도 되는 짧은 코드(주소·본문 금지) */
export type SendResult = { ok: true; id: string | null } | { ok: false; code: string };
export type EmailSender = (message: EmailMessage) => Promise<SendResult>;

export function idempotencyKey(questionId: string, userId: string, attempt: number): string {
  return `weekly/${questionId}/${userId}/${attempt}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * 메일 본문. 질문(모든 부모 동일)과 일반 링크만 담는다 — 로그인 토큰·자녀 정보·추적 요소 없음.
 * 수신 거부 링크(`unsubscribeUrl`)는 부모별 서명 링크지만 수신 동의를 끄는 것 외의 권한이 없다 (D-024).
 * `appUrl`은 끝 슬래시 없이 받는다(예: https://example.com).
 */
export function buildWeeklyEmail(input: {
  questionBody: string;
  hint: string | null;
  appUrl: string;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string; headers: Record<string, string> } {
  const writeUrl = `${input.appUrl}/write`;
  const profileUrl = `${input.appUrl}/profile`;
  const subject = "이번 주 질문이 도착했어요";
  const question = escapeHtml(input.questionBody);
  const hint = input.hint ? escapeHtml(input.hint) : null;
  const unsubscribeHtmlUrl = escapeHtml(input.unsubscribeUrl);

  const html = `<div style="font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111;line-height:1.7">
<p style="font-size:13px;color:#555;margin:0 0 8px">Hello Archive jr · 이번 주 질문</p>
<p style="font-size:20px;font-weight:700;margin:0 0 12px">${question}</p>
${hint ? `<p style="font-size:14px;color:#555;margin:0 0 20px">${hint}</p>` : ""}
<p style="margin:24px 0"><a href="${writeUrl}" style="display:inline-block;background:#d92f3e;color:#fff;text-decoration:none;padding:12px 20px;font-weight:600">기록 남기러 가기</a></p>
<p style="font-size:13px;color:#555;margin:0 0 4px">한두 줄만 적어도 첫 기록이 돼요. 이번 주 일요일까지 남길 수 있어요.</p>
<p style="font-size:12px;color:#777;margin:24px 0 0">이 메일을 더 받고 싶지 않다면 <a href="${unsubscribeHtmlUrl}" style="color:#777">수신 거부</a>를 눌러 주세요. <a href="${profileUrl}" style="color:#777">프로필</a>에서도 바꿀 수 있어요.</p>
</div>`;

  const text = [
    "이번 주 질문이 도착했어요",
    "",
    input.questionBody,
    ...(input.hint ? ["", input.hint] : []),
    "",
    `기록 남기러 가기: ${writeUrl}`,
    "한두 줄만 적어도 첫 기록이 돼요. 이번 주 일요일까지 남길 수 있어요.",
    "",
    `이 메일을 더 받고 싶지 않다면 수신 거부: ${input.unsubscribeUrl}`,
    `프로필에서도 바꿀 수 있어요: ${profileUrl}`,
  ].join("\n");

  // 메일 앱의 "구독 취소" 버튼용. 링크를 여는 것만으로는 꺼지지 않고 확인 화면에서 버튼을 눌러야 한다.
  const headers = { "List-Unsubscribe": `<${input.unsubscribeUrl}>` };

  return { subject, html, text, headers };
}
