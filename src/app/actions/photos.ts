"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getMyChild } from "@/lib/children";
import {
  checkUpload,
  IMAGE_MIME,
  isOwnPhotoPath,
  MAX_PHOTOS_PER_ENTRY,
  newPhotoPath,
  PHOTO_BUCKET,
} from "@/lib/photo-rules";
import { createClient } from "@/lib/supabase/server";

// 사진 올리기·지우기 (D-027). 클라이언트가 줄여서 보낸 사진 1장씩 받는다. 서버는 크기·형식(파일 머리)을 다시 확인하고,
// 소유자·폴더는 폼이 아니라 로그인한 부모로 정한다. Storage RLS·DB 체크가 같은 규칙으로 한 번 더 막는다.

export type PhotoActionResult = { ok: true; photoId?: string } | { ok: false; error: string };

const FAILED = "사진을 올리지 못했어요. 잠시 후 다시 눌러 주세요.";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function readUpload(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, error: "사진을 골라 주세요." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkUpload(bytes);
  if (!checked.ok) return checked;
  return { ok: true as const, bytes, kind: checked.kind };
}

async function removeObject(supabase: Supabase, path: string) {
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) console.error("[photos] 파일 삭제 실패 — 고아 파일이 남았을 수 있어요");
}

/** 기록에 사진 1장 붙이기 (기록당 최대 3장). */
export async function uploadEntryPhoto(formData: FormData): Promise<PhotoActionResult> {
  const user = await requireUser();
  const entryId = String(formData.get("entryId") ?? "");
  if (!UUID_PATTERN.test(entryId)) return { ok: false, error: "기록을 찾을 수 없어요." };

  const upload = await readUpload(formData);
  if (!upload.ok) return upload;

  const supabase = await createClient();
  const { data: entry, error: entryError } = await supabase
    .from("entries")
    .select("id")
    .eq("id", entryId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (entryError) {
    console.error("[photos] 기록 확인 실패", entryError.code);
    return { ok: false, error: FAILED };
  }
  if (!entry) return { ok: false, error: "기록을 찾을 수 없어요." };

  const { count, error: countError } = await supabase
    .from("entry_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("entry_id", entryId);
  if (countError) {
    console.error("[photos] 사진 수 확인 실패", countError.code);
    return { ok: false, error: FAILED };
  }
  if ((count ?? 0) >= MAX_PHOTOS_PER_ENTRY) {
    return { ok: false, error: `사진은 기록 하나에 ${MAX_PHOTOS_PER_ENTRY}장까지 붙일 수 있어요.` };
  }

  const path = newPhotoPath(user.id, randomUUID(), upload.kind);
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, upload.bytes, { contentType: IMAGE_MIME[upload.kind], upsert: false });
  if (uploadError) {
    console.error("[photos] 업로드 실패");
    return { ok: false, error: FAILED };
  }

  const { data: row, error: insertError } = await supabase
    .from("entry_photos")
    .insert({ user_id: user.id, entry_id: entryId, path })
    .select("id")
    .single();
  if (insertError || !row) {
    console.error("[photos] 사진 연결 실패", insertError?.code ?? "no-row");
    await removeObject(supabase, path); // 연결되지 않은 파일은 남기지 않는다
    return { ok: false, error: insertError?.message.includes("entry_photos_limit") ? `사진은 기록 하나에 ${MAX_PHOTOS_PER_ENTRY}장까지 붙일 수 있어요.` : FAILED };
  }

  revalidatePath("/", "layout");
  return { ok: true, photoId: row.id };
}

/** 기록의 사진 1장 지우기 (행과 파일 모두). */
export async function deleteEntryPhoto(input: { photoId: string }): Promise<PhotoActionResult> {
  const user = await requireUser();
  if (!UUID_PATTERN.test(input.photoId)) return { ok: false, error: "사진을 찾을 수 없어요." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entry_photos")
    .delete()
    .eq("id", input.photoId)
    .eq("user_id", user.id)
    .select("path");
  if (error || !data || data.length !== 1) {
    console.error("[photos] 사진 삭제 실패", error?.code ?? "no-row");
    return { ok: false, error: "사진을 지우지 못했어요. 잠시 후 다시 눌러 주세요." };
  }
  if (isOwnPhotoPath(user.id, data[0].path)) await removeObject(supabase, data[0].path);

  revalidatePath("/", "layout");
  return { ok: true };
}

/** 자녀 프로필 사진 바꾸기 (홈 상단·프로필의 원형 사진). 이전 사진 파일은 지운다. */
export async function uploadChildPhoto(formData: FormData): Promise<PhotoActionResult> {
  const user = await requireUser();
  const child = await getMyChild();
  if (!child) return { ok: false, error: "아이 정보를 먼저 등록해 주세요." };

  const upload = await readUpload(formData);
  if (!upload.ok) return upload;

  const supabase = await createClient();
  const path = newPhotoPath(user.id, randomUUID(), upload.kind);
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, upload.bytes, { contentType: IMAGE_MIME[upload.kind], upsert: false });
  if (uploadError) {
    console.error("[photos] 프로필 사진 업로드 실패");
    return { ok: false, error: FAILED };
  }

  const { data, error } = await supabase
    .from("children")
    .update({ photo_path: path })
    .eq("id", child.id)
    .eq("user_id", user.id)
    .select("id");
  if (error || !data || data.length !== 1) {
    console.error("[photos] 프로필 사진 저장 실패", error?.code ?? "no-row");
    await removeObject(supabase, path);
    return { ok: false, error: FAILED };
  }
  if (child.photoPath && isOwnPhotoPath(user.id, child.photoPath)) await removeObject(supabase, child.photoPath);

  revalidatePath("/", "layout");
  return { ok: true };
}

/** 자녀 프로필 사진 지우기 (다시 첫 글자 원으로 돌아간다). */
export async function removeChildPhoto(): Promise<PhotoActionResult> {
  const user = await requireUser();
  const child = await getMyChild();
  if (!child) return { ok: false, error: "아이 정보를 찾을 수 없어요." };
  if (!child.photoPath) return { ok: true };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("children")
    .update({ photo_path: null })
    .eq("id", child.id)
    .eq("user_id", user.id)
    .select("id");
  if (error || !data || data.length !== 1) {
    console.error("[photos] 프로필 사진 지우기 실패", error?.code ?? "no-row");
    return { ok: false, error: "사진을 지우지 못했어요. 잠시 후 다시 눌러 주세요." };
  }
  if (isOwnPhotoPath(user.id, child.photoPath)) await removeObject(supabase, child.photoPath);

  revalidatePath("/", "layout");
  return { ok: true };
}
