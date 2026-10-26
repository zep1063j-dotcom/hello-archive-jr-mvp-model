import { timingSafeEqual } from "node:crypto";
import { sendWithResend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWeeklyEmailJob } from "@/lib/weekly-email-job";

// 주간 질문 이메일 예약 실행 진입점 (vercel.json의 cron이 부른다, D-022).
// Vercel은 CRON_SECRET을 `Authorization: Bearer …`로 보낸다. 그 값이 아니면 거부한다.
// 응답에는 집계 숫자만 담는다(이메일 주소·본문 없음).

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (!appUrl) {
    console.error("[weekly-email] NEXT_PUBLIC_APP_URL 이 설정되지 않았어요.");
    return Response.json({ error: "app_url_not_configured" }, { status: 500 });
  }

  try {
    const summary = await runWeeklyEmailJob({
      db: createAdminClient(),
      sender: sendWithResend,
      appUrl,
      // isAuthorized를 통과했으므로 CRON_SECRET은 있다. 수신 거부 링크 서명 키로도 쓴다 (D-024).
      unsubscribeSecret: process.env.CRON_SECRET ?? "",
    });
    return Response.json(summary);
  } catch (error) {
    // 원인 코드만 남긴다 (주소·본문 금지).
    console.error("[weekly-email] 작업 실패", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "job_failed" }, { status: 500 });
  }
}
