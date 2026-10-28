"use server";

import { requireUser } from "@/lib/auth";
import { saveEmailConsent } from "@/lib/email-consent";
import { markOnboardingCompleted } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

// 환영 온보딩의 마지막 "시작하기". 완료를 계정에 기록하므로 다음 로그인부터 다시 뜨지 않는다 (D-040).
// 주간 메일 수신은 선택 항목이라 체크한 경우에만 켠다(기본 거부). 실패해도 시작은 막지 않고 프로필에서 다시 켤 수 있다.
export type CompleteOnboardingResult = { ok: true } | { ok: false; error: string };

export async function completeOnboarding(input: { emailConsent: boolean }): Promise<CompleteOnboardingResult> {
  const user = await requireUser();
  if (input.emailConsent === true) {
    await saveEmailConsent(await createClient(), user.id, true);
  }
  if (!(await markOnboardingCompleted())) {
    return { ok: false, error: "시작하지 못했어요. 잠시 후 다시 눌러 주세요." };
  }
  // 화면 갱신은 창이 닫히는 동안 화면이 바뀌지 않도록 클라이언트가 창을 닫은 뒤에 한다(router.refresh).
  return { ok: true };
}
