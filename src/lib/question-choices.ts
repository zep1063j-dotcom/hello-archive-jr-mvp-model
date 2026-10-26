import "server-only";
import { requireUser } from "@/lib/auth";
import { applyChoice, type QuestionChoiceLike } from "@/lib/question-choice-rules";
import { createClient } from "@/lib/supabase/server";
import type { WeeklyQuestion } from "@/types/archive";

// 부모별 "이 주의 질문 바꾸기" 조회 (서버 전용, D-025). 소유권은 RLS와 `user_id` 조건 양쪽으로 확인한다.

export type QuestionChoice = QuestionChoiceLike & { weeklyQuestionId: string };

// 마이그레이션(20261026000000)이 아직 적용되지 않은 DB에서도 홈·기록이 멈추지 않게, 테이블이 없는 오류만 "선택 없음"으로 본다.
// (배포 순서 실수 대비. 정상 운영에서는 일어나지 않아야 하며 로그에 남긴다.)
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

/** 내 선택 전체를 주 질문 id → 선택으로. */
export async function getMyChoices(): Promise<Map<string, QuestionChoice>> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("week_question_choices")
    .select("weekly_question_id, source, body")
    .eq("user_id", user.id);
  if (error) {
    if (MISSING_TABLE_CODES.has(error.code)) {
      console.error("[choices] week_question_choices 테이블이 없어요. 마이그레이션을 적용하세요.");
      return new Map();
    }
    console.error("[choices] 질문 선택 조회 실패", error.code);
    throw new Error("질문을 불러오지 못했어요.");
  }
  return new Map(
    data.map((row) => [
      row.weekly_question_id,
      { weeklyQuestionId: row.weekly_question_id, source: row.source, body: row.body },
    ]),
  );
}

/** 질문에 내 선택을 입힌다. 선택 목록을 이미 읽었으면 넘겨 한 번 더 조회하지 않는다. */
export async function withMyChoice(
  question: WeeklyQuestion,
  choices?: Map<string, QuestionChoice>,
): Promise<WeeklyQuestion> {
  const all = choices ?? (await getMyChoices());
  return applyChoice(question, all.get(question.id));
}
