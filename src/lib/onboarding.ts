import "server-only";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import { decideOnboardingStep, type OnboardingRecord, type OnboardingStep } from "@/lib/onboarding-rules";
import { createClient } from "@/lib/supabase/server";

// 첫 가입 환영 온보딩의 계정 기준 상태 (서버 전용, D-040). 브라우저의 임시 상태로 완료 여부를 판단하지 않는다.
// 어느 단계에서 시작할지의 규칙은 `onboarding-rules.ts`(순수 TS, 테스트됨). 여기서는 계정의 설정 행을 읽고 완료를 기록한다.
// 완료 시각 컬럼(마이그레이션 20261029000000)이 아직 없는 DB에서는 기존 사용자를 방해하지 않도록 "아이가 있으면 완료"로 본다.

// 컬럼이 없을 때: 조회는 Postgres 42703, 수정(PostgREST 스키마 캐시)은 PGRST204
const MISSING_COLUMN_CODES = new Set(["42703", "PGRST204"]);

const readRecord = cache(async (): Promise<OnboardingRecord> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parent_settings")
    .select("onboarding_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    if (MISSING_COLUMN_CODES.has(error.code)) {
      console.error("[onboarding] onboarding_completed_at 컬럼이 없어요. 마이그레이션을 적용하세요.");
      return { kind: "column-missing" };
    }
    console.error("[onboarding] 온보딩 상태 조회 실패", error.code);
    throw new Error("시작 정보를 불러오지 못했어요.");
  }
  return data ? { kind: "row", completedAt: data.onboarding_completed_at } : { kind: "no-row" };
});

/** 홈이 보여 줄 온보딩 단계. `hasChild`는 호출부가 이미 읽은 값을 넘겨 한 번 더 조회하지 않는다. */
export async function getOnboardingStep(hasChild: boolean): Promise<OnboardingStep> {
  // 아이가 없으면 상태와 상관없이 처음부터라 설정 행을 읽지 않는다.
  return decideOnboardingStep(hasChild, hasChild ? await readRecord() : { kind: "no-row" });
}

/** 온보딩 완료를 기록한다(이미 기록돼 있으면 그대로 둔다). 성공하면 true. */
export async function markOnboardingCompleted(): Promise<boolean> {
  const user = await requireUser();
  const supabase = await createClient();
  // 로그인 때 설정 행 만들기가 실패했던 계정도 마무리할 수 있게, 없으면 먼저 만든다(이미 있으면 건드리지 않는다).
  await supabase
    .from("parent_settings")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  const { error } = await supabase
    .from("parent_settings")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("onboarding_completed_at", null);
  if (error) {
    // 컬럼이 없는 DB는 완료 기록이 필요 없다(항상 완료로 본다).
    if (MISSING_COLUMN_CODES.has(error.code)) return true;
    console.error("[onboarding] 완료 기록 실패", error.code);
    return false;
  }
  return true;
}
