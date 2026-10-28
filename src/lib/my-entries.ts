import "server-only";
import { requireUser } from "@/lib/auth";
import { todayKst, weekStartOf } from "@/lib/date";
import { stageAt } from "@/lib/life-stage";
import { isPastQuestionAnswerable, joinedWeekStart, missedQuestions } from "@/lib/past-questions";
import { toLikePattern } from "@/lib/entry-search";
import { applyChoice } from "@/lib/question-choice-rules";
import { getMyChoices, type QuestionChoice } from "@/lib/question-choices";
import { signPhotoPaths } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";
import type { Child, Entry, EntryPhoto, WeeklyQuestion } from "@/types/archive";

// 주간 질문·기록 조회 (서버 전용). 소유권은 RLS와 `user_id` 조건 양쪽으로 확인한다.
// 조회 실패는 오류로 던져 (app)의 오류 화면이 받는다. 로그에는 오류 코드만 남기고 본문은 남기지 않는다.
// 쿠키를 읽으므로 Suspense 경계 안에서 호출해야 한다.

const ENTRY_COLUMNS =
  "id, body, created_at, updated_at, weekly_questions!inner(id, week_start, body, hint)";

type EntryRow = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  weekly_questions: {
    id: string;
    week_start: string;
    body: string;
    hint: string | null;
  };
};

/** 부모가 그 주 질문을 바꿨다면(`choice`) 기록에 보이는 질문도 바뀐 문구다 (D-025). */
export function toEntry(row: EntryRow, choice?: QuestionChoice, photos: EntryPhoto[] = []): Entry {
  const question = row.weekly_questions;
  return {
    id: row.id,
    question: applyChoice(
      {
        id: question.id,
        weekStart: question.week_start,
        body: question.body,
        hint: question.hint ?? undefined,
      },
      choice,
    ),
    body: row.body,
    photos,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 이번 주 질문 = 오늘(KST)이 속한 주의 월요일(`week_start`)에, 그 주 월요일 기준 아이의 시기(`stage`)에 맞는 질문 (D-038).
 * 시드가 소진돼 해당 주·시기 질문이 없으면 null (화면이 빈/안내 상태를 보여준다).
 */
export async function getThisWeekQuestion(child: Child): Promise<WeeklyQuestion | null> {
  await requireUser();
  const supabase = await createClient();
  const weekStart = weekStartOf(todayKst());
  const { data, error } = await supabase
    .from("weekly_questions")
    .select("id, week_start, body, hint")
    .eq("week_start", weekStart)
    .eq("stage", stageAt(child.birthDate, weekStart))
    .maybeSingle();
  if (error) {
    console.error("[questions] 이번 주 질문 조회 실패", error.code);
    throw new Error("이번 주 질문을 불러오지 못했어요.");
  }
  if (!data) return null;
  return applyChoice(toQuestion(data), (await getMyChoices()).get(data.id));
}

/**
 * 로그인한 부모의 해당 자녀 기록 (최신순). `search`가 있으면 본문에 그 글자가 든 기록만 (대소문자 무시 부분 일치, D-024).
 * 검색어는 로그에 남기지 않는다.
 */
export async function getMyEntries(childId: string, search?: string | null): Promise<Entry[]> {
  const user = await requireUser();
  const supabase = await createClient();
  let query = supabase
    .from("entries")
    .select(ENTRY_COLUMNS)
    .eq("user_id", user.id)
    .eq("child_id", childId);
  if (search) query = query.ilike("body", toLikePattern(search));
  // 기록·사진 목록·질문 선택은 서로 기다릴 필요가 없어 동시에 읽는다 (왕복 횟수를 줄인다).
  const [{ data, error }, choices, photos] = await Promise.all([
    query.order("created_at", { ascending: false }),
    getMyChoices(),
    getMyPhotoRows(supabase, user.id),
  ]);
  if (error) {
    console.error("[entries] 기록 조회 실패", error.code);
    throw new Error("기록을 불러오지 못했어요.");
  }
  const urls = await signPhotosForEntries(supabase, photos, new Set(data.map((row) => row.id)));
  return data.map((row) => toEntry(row, choices.get(row.weekly_questions.id), urls.get(row.id)));
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 기록 하나. 형식이 틀렸거나 내 기록이 아니면 null (존재 여부를 구분해 알려주지 않는다). */
export async function getMyEntry(entryId: string): Promise<Entry | null> {
  if (!UUID_PATTERN.test(entryId)) return null;
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .select(ENTRY_COLUMNS)
    .eq("id", entryId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[entries] 기록 조회 실패", error.code);
    throw new Error("기록을 불러오지 못했어요.");
  }
  if (!data) return null;
  const [choices, photos] = await Promise.all([getMyChoices(), getPhotosByEntry(supabase, user.id, [data.id])]);
  return toEntry(data, choices.get(data.weekly_questions.id), photos.get(data.id));
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

type PhotoRow = { id: string; entry_id: string; path: string };

/** 내 기록 사진 행 전부(오래된 것 먼저). 사진 테이블이 없으면 빈 목록(배포 순서 실수 대비, 로그만 남김). */
async function getMyPhotoRows(supabase: Supabase, userId: string): Promise<PhotoRow[]> {
  const { data, error } = await supabase
    .from("entry_photos")
    .select("id, entry_id, path")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[photos] 기록 사진 조회 실패", error.code);
    return [];
  }
  return data;
}

/** 대상 기록(`entryIds`)의 사진만 서명 URL을 만들어 기록 id → 사진 목록으로 묶는다. */
async function signPhotosForEntries(
  supabase: Supabase,
  rows: PhotoRow[],
  entryIds: Set<string>,
): Promise<Map<string, EntryPhoto[]>> {
  const result = new Map<string, EntryPhoto[]>();
  const wanted = rows.filter((row) => entryIds.has(row.entry_id));
  if (wanted.length === 0) return result;
  const urls = await signPhotoPaths(supabase, wanted.map((row) => row.path));
  for (const row of wanted) {
    const url = urls.get(row.path);
    if (!url) continue;
    const list = result.get(row.entry_id) ?? [];
    list.push({ id: row.id, url });
    result.set(row.entry_id, list);
  }
  return result;
}

/** 기록 id → 사진 목록(오래된 것 먼저, 서명 URL 포함). */
async function getPhotosByEntry(
  supabase: Supabase,
  userId: string,
  entryIds: string[],
): Promise<Map<string, EntryPhoto[]>> {
  if (entryIds.length === 0) return new Map();
  return signPhotosForEntries(supabase, await getMyPhotoRows(supabase, userId), new Set(entryIds));
}

type QuestionRow = { id: string; week_start: string; body: string; hint: string | null };

const toQuestion = (row: QuestionRow): WeeklyQuestion => ({
  id: row.id,
  weekStart: row.week_start,
  body: row.body,
  hint: row.hint ?? undefined,
});

/**
 * 아직 답하지 않은 지난 질문 (최근 주 먼저, D-024). 자녀를 등록한 주 이후 ~ 지난주, 시드에 있는 주만.
 * `entries`는 해당 자녀의 기록 목록(또는 그것을 읽는 중인 Promise)을 넘겨 한 번 더 조회하지 않는다.
 * Promise를 넘기면 질문 조회가 기록 조회와 동시에 진행된다.
 */
export async function getMissedQuestions(
  child: Child,
  entries: Entry[] | Promise<Entry[]>,
): Promise<WeeklyQuestion[]> {
  await requireUser();
  const thisWeekStart = weekStartOf(todayKst());
  const joined = joinedWeekStart(child.createdAt);
  if (joined >= thisWeekStart) return [];

  const supabase = await createClient();
  const [{ data, error }, choices, answered] = await Promise.all([
    supabase
      .from("weekly_questions")
      .select("id, week_start, stage, body, hint")
      .gte("week_start", joined)
      .lt("week_start", thisWeekStart)
      .order("week_start", { ascending: false }),
    getMyChoices(),
    entries,
  ]);
  if (error) {
    console.error("[questions] 지난 질문 조회 실패", error.code);
    throw new Error("지난 질문을 불러오지 못했어요.");
  }
  // 주마다 시기별 질문이 여러 개 있으니, 그 주 월요일 기준 아이의 시기에 맞는 질문만 남긴다 (D-038).
  const mine = data.filter((row) => row.stage === stageAt(child.birthDate, row.week_start));
  return missedQuestions({
    questions: mine.map((row) => applyChoice(toQuestion(row), choices.get(row.id))),
    answeredWeekStarts: new Set(answered.map((entry) => entry.question.weekStart)),
    thisWeekStart,
    joinedWeekStart: joined,
  });
}

const WEEK_START_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 쓸 수 있는 지난 질문 하나. 형식이 틀렸거나 쓸 수 없는 주(이번 주·미래·등록 전·질문 없음)면 null. */
export async function getPastQuestion(child: Child, weekStart: string): Promise<WeeklyQuestion | null> {
  if (!WEEK_START_PATTERN.test(weekStart)) return null;
  const answerable = isPastQuestionAnswerable({
    questionWeekStart: weekStart,
    thisWeekStart: weekStartOf(todayKst()),
    joinedWeekStart: joinedWeekStart(child.createdAt),
  });
  if (!answerable) return null;

  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_questions")
    .select("id, week_start, body, hint")
    .eq("week_start", weekStart)
    .eq("stage", stageAt(child.birthDate, weekStart))
    .maybeSingle();
  if (error) {
    console.error("[questions] 지난 질문 조회 실패", error.code);
    throw new Error("질문을 불러오지 못했어요.");
  }
  if (!data) return null;
  return applyChoice(toQuestion(data), (await getMyChoices()).get(data.id));
}
