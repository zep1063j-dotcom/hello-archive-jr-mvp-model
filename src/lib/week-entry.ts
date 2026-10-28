import "server-only";
import { createClient } from "@/lib/supabase/server";

// 한 주(`week_start`)에 이 자녀가 남긴 기록과, 그 기록이 매달린 질문 행 (서버 전용, D-039).
// 같은 주에도 시기별 질문 행이 여러 개라서(D-038) "질문 id로 기록 찾기"는 다른 시기의 행에 매달린 기록을 놓친다.
// 저장·질문 바꾸기는 지금 시기의 질문 행이 아니라 이 기록의 질문 행을 기준으로 한다. 소유권은 RLS와 `user_id` 조건 양쪽으로 확인한다.

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type WeekEntryRow = {
  entryId: string;
  /** 기록이 매달린 질문 행 */
  question: { id: string; body: string };
};

/** 그 주의 기록 하나(여러 개면 가장 먼저 쓴 것). 없으면 null. 조회 실패는 오류로 던진다. */
export async function findWeekEntry(
  supabase: Supabase,
  userId: string,
  childId: string,
  weekStart: string,
): Promise<WeekEntryRow | null> {
  const { data, error } = await supabase
    .from("entries")
    .select("id, weekly_questions!inner(id, body, week_start)")
    .eq("user_id", userId)
    .eq("child_id", childId)
    .eq("weekly_questions.week_start", weekStart)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) {
    console.error("[entries] 이번 주 기록 확인 실패", error.code);
    throw new Error("기록을 확인하지 못했어요.");
  }
  const row = data[0];
  if (!row) return null;
  return { entryId: row.id, question: { id: row.weekly_questions.id, body: row.weekly_questions.body } };
}
