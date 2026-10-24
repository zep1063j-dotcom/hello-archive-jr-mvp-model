import "server-only";
import { requireUser } from "@/lib/auth";
import { todayKst, weekStartOf } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import type { Entry, WeeklyQuestion } from "@/types/archive";

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

export function toEntry(row: EntryRow): Entry {
  const question = row.weekly_questions;
  return {
    id: row.id,
    question: {
      id: question.id,
      weekStart: question.week_start,
      body: question.body,
      hint: question.hint ?? undefined,
    },
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 이번 주 질문 = 오늘(KST)이 속한 주의 월요일(`week_start`)의 질문.
 * 시드가 소진돼 해당 주 질문이 없으면 null (화면이 빈/안내 상태를 보여준다).
 */
export async function getThisWeekQuestion(): Promise<WeeklyQuestion | null> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_questions")
    .select("id, week_start, body, hint")
    .eq("week_start", weekStartOf(todayKst()))
    .maybeSingle();
  if (error) {
    console.error("[questions] 이번 주 질문 조회 실패", error.code);
    throw new Error("이번 주 질문을 불러오지 못했어요.");
  }
  return data
    ? {
        id: data.id,
        weekStart: data.week_start,
        body: data.body,
        hint: data.hint ?? undefined,
      }
    : null;
}

/** 로그인한 부모의 해당 자녀 기록 전체 (최신순). */
export async function getMyEntries(childId: string): Promise<Entry[]> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .select(ENTRY_COLUMNS)
    .eq("user_id", user.id)
    .eq("child_id", childId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[entries] 기록 조회 실패", error.code);
    throw new Error("기록을 불러오지 못했어요.");
  }
  return data.map(toEntry);
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
  return data ? toEntry(data) : null;
}
