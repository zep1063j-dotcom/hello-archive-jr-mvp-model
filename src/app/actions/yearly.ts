"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getMyChild } from "@/lib/children";
import { todayKst } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import { validateYearlyAnswer, yearOfDateKey, YEARLY_QUESTIONS } from "@/lib/yearly-questions";

// 매년 같은 질문 답 저장 (D-026). 연도는 클라이언트가 아니라 서버가 정한 "지금 연도(KST)"다 — 지난 연도의 답은 고칠 수 없다.
// 소유자·자녀도 폼이 아니라 로그인한 부모와 그 부모의 자녀로 정한다.

export type YearlyFormState = { status: "idle" } | { status: "saved"; message: string } | { status: "error"; message: string };

const FAILED = "저장하지 못했어요. 쓴 내용은 그대로 있어요. 잠시 후 다시 눌러 주세요.";

export async function saveYearlyAnswers(
  _previous: YearlyFormState,
  formData: FormData,
): Promise<YearlyFormState> {
  const user = await requireUser();
  const child = await getMyChild();
  if (!child) return { status: "error", message: "아이 정보를 먼저 등록해 주세요." };

  // 하나라도 검증에 실패하면 아무것도 저장하지 않는다.
  const answers: { key: string; value: string | null }[] = [];
  for (const question of YEARLY_QUESTIONS) {
    const parsed = validateYearlyAnswer(formData.get(`a_${question.key}`));
    if (!parsed.ok) return { status: "error", message: `“${question.label}” — ${parsed.error}` };
    answers.push({ key: question.key, value: parsed.value });
  }

  const year = yearOfDateKey(todayKst());
  const supabase = await createClient();

  const { data: existing, error: readError } = await supabase
    .from("yearly_answers")
    .select("id, question_key, body")
    .eq("user_id", user.id)
    .eq("child_id", child.id)
    .eq("year", year);
  if (readError) {
    console.error("[yearly] 기존 답 확인 실패", readError.code);
    return { status: "error", message: FAILED };
  }
  const byKey = new Map(existing.map((row) => [row.question_key, row]));

  let changed = 0;
  for (const { key, value } of answers) {
    const current = byKey.get(key);
    if (value === null) {
      if (!current) continue;
      const { error } = await supabase.from("yearly_answers").delete().eq("id", current.id).eq("user_id", user.id);
      if (error) {
        console.error("[yearly] 답 삭제 실패", error.code);
        return { status: "error", message: FAILED };
      }
      changed += 1;
      continue;
    }
    if (current) {
      if (current.body === value) continue;
      const { data, error } = await supabase
        .from("yearly_answers")
        .update({ body: value })
        .eq("id", current.id)
        .eq("user_id", user.id)
        .select("id");
      if (error || !data || data.length !== 1) {
        console.error("[yearly] 답 수정 실패", error?.code ?? "no-row");
        return { status: "error", message: FAILED };
      }
      changed += 1;
      continue;
    }
    const { error } = await supabase
      .from("yearly_answers")
      .insert({ user_id: user.id, child_id: child.id, year, question_key: key, body: value });
    if (error?.code === "23505") {
      // 동시 요청(다른 탭·이중 제출)이 먼저 만들었다. 그 답을 이번 값으로 고친다.
      const { data, error: updateError } = await supabase
        .from("yearly_answers")
        .update({ body: value })
        .eq("user_id", user.id)
        .eq("child_id", child.id)
        .eq("year", year)
        .eq("question_key", key)
        .select("id");
      if (updateError || !data || data.length !== 1) {
        console.error("[yearly] 동시 저장 보정 실패", updateError?.code ?? "no-row");
        return { status: "error", message: FAILED };
      }
    } else if (error) {
      console.error("[yearly] 답 저장 실패", error.code);
      return { status: "error", message: FAILED };
    }
    changed += 1;
  }

  revalidatePath("/", "layout");
  return {
    status: "saved",
    message: changed === 0 ? "바뀐 내용이 없어요." : `${year}년 답을 저장했어요.`,
  };
}
