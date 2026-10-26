import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Child } from "@/types/archive";

/**
 * 로그인한 부모의 자녀를 읽는다 (MVP는 1명). 자녀가 없으면 null.
 * 소유권은 RLS와 `user_id` 조건 양쪽으로 확인한다. 조회 실패는 오류로 던져 오류 화면이 받는다.
 * (쿠키를 읽으므로 Suspense 경계 안에서 호출해야 한다.)
 */
export async function getMyChild(): Promise<Child | null> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("children")
    .select("id, nickname, birth_date, created_at, photo_path")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    // 사진 마이그레이션(20261026000200)이 아직 적용되지 않은 DB: 모든 화면이 이 함수를 쓰므로 멈추지 않게
    // photo_path 없이 다시 읽는다 (배포 순서 실수 대비. 정상 운영에서는 일어나지 않아야 하며 로그에 남긴다).
    if (error.code === "42703") {
      console.error("[children] photo_path 컬럼이 없어요. 마이그레이션을 적용하세요.");
      return getMyChildWithoutPhoto(user.id);
    }
    console.error("[children] 자녀 조회 실패", error.code);
    throw new Error("자녀 정보를 불러오지 못했어요.");
  }
  return data
    ? {
        id: data.id,
        nickname: data.nickname,
        birthDate: data.birth_date,
        createdAt: data.created_at,
        photoPath: data.photo_path,
      }
    : null;
}

async function getMyChildWithoutPhoto(userId: string): Promise<Child | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("children")
    .select("id, nickname, birth_date, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[children] 자녀 조회 실패", error.code);
    throw new Error("자녀 정보를 불러오지 못했어요.");
  }
  return data
    ? {
        id: data.id,
        nickname: data.nickname,
        birthDate: data.birth_date,
        createdAt: data.created_at,
        photoPath: null,
      }
    : null;
}

/**
 * 자녀가 등록돼 있어야 하는 화면에서 부른다. 없으면 온보딩으로 보내고, 등록 후 `next`로 돌아오게 한다.
 */
export async function requireChild(next: string): Promise<Child> {
  const child = await getMyChild();
  if (!child) {
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }
  return child;
}
