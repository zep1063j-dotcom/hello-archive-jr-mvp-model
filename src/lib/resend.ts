import "server-only";
import type { EmailMessage, SendResult } from "@/lib/weekly-email";

// Resend REST API로 메일 한 통을 보낸다 (라이브러리 없이 fetch).
// 반환하는 code는 로그·DB에 남겨도 되는 짧은 코드뿐이다 (수신 주소·본문·응답 내용은 남기지 않는다).
export async function sendWithResend(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, code: "email_not_configured" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.headers ? { headers: message.headers } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { ok: false, code: `resend_${response.status}` };
    const body: unknown = await response.json().catch(() => null);
    const id =
      body && typeof body === "object" && "id" in body && typeof body.id === "string"
        ? body.id
        : null;
    return { ok: true, id };
  } catch {
    return { ok: false, code: "resend_network" };
  }
}
