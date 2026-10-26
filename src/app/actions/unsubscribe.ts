"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { unsubscribeWithToken } from "@/lib/unsubscribe";

// 메일의 수신 거부 링크에서 확인 버튼을 눌렀을 때. 로그인 세션이 없으므로 서명(HMAC)이 권한의 전부이고,
// 서명이 맞을 때만 service role로 "그 부모의 수신 동의 끄기" 한 가지를 한다 (D-024).
export async function confirmUnsubscribe(formData: FormData) {
  const userId = String(formData.get("u") ?? "");
  const token = String(formData.get("t") ?? "");

  let target = "/unsubscribe?error=failed";
  try {
    const result = await unsubscribeWithToken({
      db: createAdminClient(),
      userId,
      token,
      secret: process.env.CRON_SECRET ?? "",
    });
    if (result.ok) target = "/unsubscribe?done=1";
    else if (result.reason === "invalid") target = "/unsubscribe?error=invalid";
    else console.error("[unsubscribe] 수신 거부 저장 실패");
  } catch {
    console.error("[unsubscribe] 수신 거부 처리 중 오류");
  }
  redirect(target);
}
