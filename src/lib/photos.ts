import "server-only";
import { PHOTO_BUCKET, SIGNED_URL_SECONDS } from "@/lib/photo-rules";
import { createClient } from "@/lib/supabase/server";

// 사진 보기용 서명 URL (서버 전용, D-027). 버킷은 비공개라 공개 주소가 없고, 이 URL은 짧게 유효하다.
// 마이그레이션(20261026000200)이 아직 적용되지 않은 DB에서도 화면이 멈추지 않게, 서명 실패는 "사진 없음"으로 보고 로그만 남긴다.

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** 경로 → 서명 URL. 서명하지 못한 경로는 결과에서 빠진다. */
export async function signPhotoPaths(supabase: Supabase, paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error || !data) {
    console.error("[photos] 서명 URL 생성 실패");
    return result;
  }
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) result.set(item.path, item.signedUrl);
  }
  return result;
}

/** 프로필 사진 서명 URL. 사진이 없으면 null. */
export async function getChildPhotoUrl(photoPath: string | null): Promise<string | null> {
  if (!photoPath) return null;
  const supabase = await createClient();
  const urls = await signPhotoPaths(supabase, [photoPath]);
  return urls.get(photoPath) ?? null;
}
