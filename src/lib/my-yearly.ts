import "server-only";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { YearlyAnswerRow } from "@/lib/yearly-questions";

// 매년 같은 질문의 내 답 조회 (서버 전용, D-026). 소유권은 RLS와 `user_id` 조건 양쪽으로 확인한다.
// 쿠키를 읽으므로 Suspense 경계 안에서 호출해야 한다.

/** 해당 자녀의 모든 연도 답. */
export async function getMyYearlyAnswers(childId: string): Promise<YearlyAnswerRow[]> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("yearly_answers")
    .select("year, question_key, body")
    .eq("user_id", user.id)
    .eq("child_id", childId)
    .order("year", { ascending: false });
  if (error) {
    console.error("[yearly] 답 조회 실패", error.code);
    throw new Error("매년 질문의 답을 불러오지 못했어요.");
  }
  return data.map((row) => ({ year: row.year, questionKey: row.question_key, body: row.body }));
}
