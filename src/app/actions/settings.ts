"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { saveEmailConsent } from "@/lib/email-consent";
import { createClient } from "@/lib/supabase/server";

// 프로필의 주간 이메일 수신 켜기/끄기. 폼 값은 "1"(받기)과 "0"(받지 않기)만 인정하고,
// 대상은 폼이 아니라 로그인한 부모 본인으로 서버가 정한다.
export async function setEmailConsent(formData: FormData) {
  const user = await requireUser();
  const value = formData.get("consent");
  if (value !== "1" && value !== "0") redirect("/profile?consent=error");

  const supabase = await createClient();
  const ok = await saveEmailConsent(supabase, user.id, value === "1");
  redirect(ok ? `/profile?consent=${value === "1" ? "on" : "off"}` : "/profile?consent=error");
}
