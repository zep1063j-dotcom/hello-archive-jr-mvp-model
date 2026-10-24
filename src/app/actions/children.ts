"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, safeNextPath } from "@/lib/auth";
import {
  validateChildInput,
  type ChildFieldErrors,
} from "@/lib/child-validation";
import { todayKst } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

// 자녀 폼 상태. 오류가 나도 입력한 값을 돌려줘 폼이 비워지지 않게 한다.
export type ChildFormState = {
  values: { nickname: string; birthDate: string };
  fieldErrors?: ChildFieldErrors;
  error?: string;
};

function readValues(formData: FormData) {
  return {
    nickname: String(formData.get("nickname") ?? ""),
    birthDate: String(formData.get("birthDate") ?? ""),
  };
}

// 첫 자녀 등록 (온보딩). MVP는 부모당 자녀 1명이라 이미 있으면 새로 만들지 않는다 (D-013: 제한은 앱 로직).
// 소유자(user_id)는 폼 값이 아니라 서버가 확인한 로그인 사용자로 정한다.
export async function createChild(
  _prev: ChildFormState,
  formData: FormData,
): Promise<ChildFormState> {
  const user = await requireUser();
  const next = safeNextPath(formData.get("next"));
  const values = readValues(formData);

  const parsed = validateChildInput(values, todayKst());
  if (!parsed.ok) return { values, fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("children")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) {
    console.error("[children] 자녀 수 확인 실패", countError.code);
    return { values, error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  // 이미 등록돼 있으면(다른 탭·이중 제출) 만들지 않고 계속 진행한다. 동시 요청은 DB 유니크 인덱스가 막는다.
  if (!count) {
    const { error } = await supabase.from("children").insert({
      user_id: user.id,
      nickname: parsed.value.nickname,
      birth_date: parsed.value.birthDate,
    });
    // 23505: 동시 요청이 먼저 등록했다 (DB의 부모당 1명 제한). 이미 등록된 것이므로 성공으로 본다.
    if (error && error.code !== "23505") {
      console.error("[children] 자녀 등록 실패", error.code);
      return { values, error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
    }
  }

  revalidatePath("/", "layout");
  redirect(next);
}

// 자녀 정보 수정 (프로필). 수정 대상은 폼의 id가 아니라 로그인한 부모의 자녀로 서버가 정한다.
// 수정 가능한 컬럼은 별명·생년월일뿐이다 (DB의 컬럼 단위 GRANT도 같은 범위).
export async function updateChild(
  _prev: ChildFormState,
  formData: FormData,
): Promise<ChildFormState> {
  const user = await requireUser();
  const values = readValues(formData);

  const parsed = validateChildInput(values, todayKst());
  if (!parsed.ok) return { values, fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const { data: existing, error: findError } = await supabase
    .from("children")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (findError) {
    console.error("[children] 자녀 조회 실패", findError.code);
    return { values, error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  if (!existing) {
    redirect("/onboarding?next=%2Fprofile");
  }

  // RLS가 걸러내면 오류 없이 0행이 갱신되므로, 갱신된 행이 있는지도 확인한다.
  const { data: updated, error } = await supabase
    .from("children")
    .update({
      nickname: parsed.value.nickname,
      birth_date: parsed.value.birthDate,
    })
    .eq("id", existing.id)
    .eq("user_id", user.id)
    .select("id");
  if (error || !updated || updated.length !== 1) {
    console.error("[children] 자녀 수정 실패", error?.code ?? "no-row");
    return { values, error: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/", "layout");
  redirect("/profile?saved=1");
}
