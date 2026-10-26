"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getMyChild } from "@/lib/children";
import { validateEntryBody } from "@/lib/entry-validation";
import { getThisWeekQuestion } from "@/lib/my-entries";
import { isPastQuestionAnswerable, joinedWeekStart } from "@/lib/past-questions";
import { PHOTO_BUCKET } from "@/lib/photo-rules";
import { todayKst, weekStartOf } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

// 기록 저장·수정·삭제. 소유자(user_id)와 자녀는 클라이언트 값이 아니라 서버가 확인한 로그인 사용자·그 부모의 자녀로 정한다.
// 소유권은 RLS와 `user_id` 조건 양쪽에서 확인한다 (RLS가 걸러내면 오류 없이 0행이라 갱신 행 수도 확인).

/** `entryId`는 저장된(또는 수정된) 기록의 id — 화면이 이어서 사진을 올릴 때 쓴다 (D-027). */
export type EntryActionResult = { ok: true; entryId?: string } | { ok: false; error: string };

const SAVE_FAILED = "저장하지 못했어요. 쓴 내용은 그대로 있어요. 잠시 후 다시 눌러 주세요.";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** 내 기록의 본문만 바꾼다 (DB의 컬럼 단위 GRANT도 `body`만 허용). 갱신된 행이 정확히 1개일 때만 성공. */
async function updateBody(
  supabase: Supabase,
  userId: string,
  entryId: string,
  body: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("entries")
    .update({ body })
    .eq("id", entryId)
    .eq("user_id", userId)
    .select("id");
  if (error || !data || data.length !== 1) {
    console.error("[entries] 기록 수정 실패", error?.code ?? "no-row");
    return false;
  }
  return true;
}

/**
 * 한 질문에 대한 기록을 만들거나(없을 때) 수정한다(있을 때). 이번 주·지난 질문 저장이 함께 쓴다.
 * 같은 질문에 다시 쓰면 새 기록이 아니라 수정이고(D-005), 동시 요청이 겹쳐도 기록은 1개다.
 * 호출부가 질문과 본문을 이미 검증했다는 전제다.
 */
async function saveEntryForQuestion(
  userId: string,
  childId: string,
  questionId: string,
  body: string,
): Promise<EntryActionResult> {
  const supabase = await createClient();
  const findExisting = () =>
    supabase
      .from("entries")
      .select("id")
      .eq("user_id", userId)
      .eq("child_id", childId)
      .eq("weekly_question_id", questionId)
      .maybeSingle();

  const { data: existing, error: findError } = await findExisting();
  if (findError) {
    console.error("[entries] 기존 기록 확인 실패", findError.code);
    return { ok: false, error: SAVE_FAILED };
  }

  let entryId: string;
  if (existing) {
    if (!(await updateBody(supabase, userId, existing.id, body))) {
      return { ok: false, error: SAVE_FAILED };
    }
    entryId = existing.id;
  } else {
    const { data: created, error } = await supabase
      .from("entries")
      .insert({
        user_id: userId,
        child_id: childId,
        weekly_question_id: questionId,
        body,
      })
      .select("id")
      .single();
    if (error?.code === "23505") {
      // 동시 요청(다른 탭·이중 제출)이 먼저 만들었다. 새 기록을 또 만들지 않고 그 기록을 수정한다.
      const { data: raced } = await findExisting();
      if (!raced || !(await updateBody(supabase, userId, raced.id, body))) {
        return { ok: false, error: SAVE_FAILED };
      }
      entryId = raced.id;
    } else if (error || !created) {
      console.error("[entries] 기록 저장 실패", error?.code ?? "no-row");
      return { ok: false, error: SAVE_FAILED };
    } else {
      entryId = created.id;
    }
  }

  revalidatePath("/", "layout");
  return { ok: true, entryId };
}

/**
 * 이번 주 질문에 대한 기록을 저장한다. 이번 주 질문에만 쓸 수 있고(DB는 막지 않음, D-013), 같은 주에 다시 쓰면 새 기록이 아니라 수정이다 (D-005).
 * `weeklyQuestionId`는 화면이 보여준 질문이다. 주가 바뀐 뒤 이전 질문으로 저장되는 것을 막으려고 서버의 이번 주 질문과 대조한다.
 */
export async function saveThisWeekEntry(input: {
  weeklyQuestionId: string;
  body: string;
}): Promise<EntryActionResult> {
  const user = await requireUser();
  const parsed = validateEntryBody(input.body);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const child = await getMyChild();
  // 호출부가 redirect를 예외로 받아 오류 문구를 띄우므로 이동 대신 안내 문구를 돌려준다.
  if (!child) {
    return { ok: false, error: "아이 정보를 먼저 등록해 주세요. 홈에서 다시 시작할 수 있어요." };
  }

  const question = await getThisWeekQuestion();
  if (!question) {
    return { ok: false, error: "이번 주 질문이 아직 준비되지 않았어요." };
  }
  if (question.id !== input.weeklyQuestionId) {
    return {
      ok: false,
      error: "새로운 주가 시작됐어요. 화면을 새로고침한 뒤 새 질문에 적어 주세요.",
    };
  }

  return saveEntryForQuestion(user.id, child.id, question.id, parsed.value);
}

/**
 * 놓친 지난 질문에 기록을 저장한다 (D-024). 자녀를 등록한 주 이후 ~ 지난주의 질문만 허용하고,
 * 그 질문에 이미 기록이 있으면 수정으로 처리한다. 화면이 보낸 질문 id가 아니라 서버가 질문의 주를 읽어 판단한다.
 */
export async function savePastEntry(input: {
  weeklyQuestionId: string;
  body: string;
}): Promise<EntryActionResult> {
  const user = await requireUser();
  const parsed = validateEntryBody(input.body);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (!UUID_PATTERN.test(input.weeklyQuestionId)) {
    return { ok: false, error: "질문을 찾을 수 없어요." };
  }

  const child = await getMyChild();
  if (!child) {
    return { ok: false, error: "아이 정보를 먼저 등록해 주세요. 홈에서 다시 시작할 수 있어요." };
  }

  const supabase = await createClient();
  const { data: question, error } = await supabase
    .from("weekly_questions")
    .select("id, week_start")
    .eq("id", input.weeklyQuestionId)
    .maybeSingle();
  if (error) {
    console.error("[entries] 질문 확인 실패", error.code);
    return { ok: false, error: SAVE_FAILED };
  }
  const answerable =
    question &&
    isPastQuestionAnswerable({
      questionWeekStart: question.week_start,
      thisWeekStart: weekStartOf(todayKst()),
      joinedWeekStart: joinedWeekStart(child.createdAt),
    });
  if (!question || !answerable) {
    return { ok: false, error: "이 질문에는 지금 기록을 남길 수 없어요." };
  }

  return saveEntryForQuestion(user.id, child.id, question.id, parsed.value);
}

/** 기존 기록의 본문 수정 (상세 화면). 지난 기록의 오타 수정처럼 이번 주가 아니어도 허용한다. */
export async function updateEntry(input: {
  entryId: string;
  body: string;
}): Promise<EntryActionResult> {
  const user = await requireUser();
  const parsed = validateEntryBody(input.body);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (!UUID_PATTERN.test(input.entryId)) {
    return { ok: false, error: "기록을 찾을 수 없어요." };
  }

  const supabase = await createClient();
  if (!(await updateBody(supabase, user.id, input.entryId, parsed.value))) {
    return { ok: false, error: SAVE_FAILED };
  }

  revalidatePath("/", "layout");
  return { ok: true, entryId: input.entryId };
}

export type DeleteEntryState = { error?: string };

/**
 * 기록 삭제. 되돌릴 수 없으므로 화면이 확인을 거친 뒤 폼으로 부른다. 성공하면 아카이브로 이동한다.
 * 이동(redirect)을 프레임워크가 처리하도록 폼 액션(useActionState)으로 받는다.
 */
export async function deleteEntry(
  _prev: DeleteEntryState,
  formData: FormData,
): Promise<DeleteEntryState> {
  const user = await requireUser();
  const entryId = String(formData.get("entryId") ?? "");
  if (!UUID_PATTERN.test(entryId)) {
    return { error: "기록을 찾을 수 없어요." };
  }

  const supabase = await createClient();
  // 기록을 지우면 사진 행은 함께 지워지지만 Storage 파일은 남는다. 먼저 경로를 읽어 두었다가 지운 뒤 파일도 지운다 (D-027).
  const { data: photoRows, error: photoReadError } = await supabase
    .from("entry_photos")
    .select("path")
    .eq("user_id", user.id)
    .eq("entry_id", entryId);
  if (photoReadError) console.error("[entries] 사진 경로 조회 실패", photoReadError.code);

  const { data, error } = await supabase
    .from("entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", user.id)
    .select("id");
  if (error || !data || data.length !== 1) {
    console.error("[entries] 기록 삭제 실패", error?.code ?? "no-row");
    return { error: "삭제하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  if (photoRows && photoRows.length > 0) {
    const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove(photoRows.map((row) => row.path));
    if (removeError) console.error("[entries] 사진 파일 삭제 실패 — 고아 파일이 남았을 수 있어요");
  }

  revalidatePath("/", "layout");
  redirect("/archive");
}
