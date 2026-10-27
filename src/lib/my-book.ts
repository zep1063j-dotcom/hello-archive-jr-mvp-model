import "server-only";
import { requireUser } from "@/lib/auth";
import { isProductKey, summarizeBook, type BookPreview, type ProductKey } from "@/lib/book-preview";
import { createClient } from "@/lib/supabase/server";

// 제작 탭 조회 (서버 전용, D-036). 소유권은 RLS와 `user_id` 조건 양쪽으로 확인한다.
// 쿠키를 읽으므로 Suspense 경계 안에서 호출해야 한다. 기록 본문은 읽지 않고 시각과 개수만 센다.

/** 지금까지의 기록으로 책 한 권 분량을 요약한다. 기록이 없으면 null. */
export async function getMyBookPreview(childId: string): Promise<BookPreview | null> {
  const user = await requireUser();
  const supabase = await createClient();
  const [entries, photos] = await Promise.all([
    supabase.from("entries").select("created_at").eq("user_id", user.id).eq("child_id", childId),
    supabase.from("entry_photos").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  if (entries.error) {
    console.error("[book] 기록 조회 실패", entries.error.code);
    throw new Error("기록을 불러오지 못했어요.");
  }
  // 사진 테이블을 못 읽어도 제작 화면은 열리게 한다(사진 수만 0으로 둔다).
  if (photos.error) console.error("[book] 사진 수 조회 실패", photos.error.code);
  return summarizeBook(
    entries.data.map((row) => row.created_at),
    photos.count ?? 0,
  );
}

/** 내가 관심 표시한 상품. 테이블이 아직 없는 DB(배포 순서 실수)에서는 빈 목록으로 두고 로그만 남긴다. */
export async function getMyInterests(): Promise<Set<ProductKey>> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_interests").select("product").eq("user_id", user.id);
  if (error) {
    console.error("[book] 관심 표시 조회 실패", error.code);
    return new Set();
  }
  return new Set(data.map((row) => row.product).filter(isProductKey));
}
