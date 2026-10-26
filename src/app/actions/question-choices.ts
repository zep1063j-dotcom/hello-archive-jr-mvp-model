"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getMyChild } from "@/lib/children";
import { getMyEntries } from "@/lib/my-entries";
import { pickRandomBankQuestion, validateCustomQuestion } from "@/lib/question-choice-rules";
import { getMyChoices } from "@/lib/question-choices";
import { todayKst, weekStartOf } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

// 이번 주 질문 바꾸기: 은행에서 무작위로 바꾸기 / 직접 쓴 질문으로 바꾸기 / 기본 질문으로 되돌리기 (D-025).
// 대상은 폼이 보낸 값이 아니라 서버가 정한 "오늘(KST)이 속한 주의 질문"이다. 그 주에 이미 기록이 있으면 바꿀 수 없다
// (서버 확인 + DB RLS가 수정·삭제를 0행으로 막는다). 한 주에 기록은 하나이고, 기록을 남기면 그 주 질문은 고정된다.

export type ChoiceActionResult =
  | { ok: true; question: { body: string; source: "bank" | "custom" | null } }
  | { ok: false; error: string };

const FAILED = "질문을 바꾸지 못했어요. 잠시 후 다시 눌러 주세요.";
const LOCKED = "이미 이번 주 기록을 남겨서 질문을 바꿀 수 없어요. 기록을 지우면 다시 바꿀 수 있어요.";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type WeekContext = {
  userId: string;
  supabase: Supabase;
  week: { id: string; body: string };
};

/** 이번 주 기본 질문과 잠금 여부를 확인한다. 바꿀 수 없으면 사용자에게 보여줄 문구를 돌려준다. */
async function loadEditableWeek(): Promise<{ ok: true; ctx: WeekContext } | { ok: false; error: string }> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: week, error } = await supabase
    .from("weekly_questions")
    .select("id, body")
    .eq("week_start", weekStartOf(todayKst()))
    .maybeSingle();
  if (error) {
    console.error("[choices] 이번 주 질문 조회 실패", error.code);
    return { ok: false, error: FAILED };
  }
  if (!week) return { ok: false, error: "이번 주 질문이 아직 준비되지 않았어요." };

  const { data: existing, error: entryError } = await supabase
    .from("entries")
    .select("id")
    .eq("user_id", user.id)
    .eq("weekly_question_id", week.id)
    .limit(1);
  if (entryError) {
    console.error("[choices] 기록 확인 실패", entryError.code);
    return { ok: false, error: FAILED };
  }
  if (existing.length > 0) return { ok: false, error: LOCKED };

  return { ok: true, ctx: { userId: user.id, supabase, week } };
}

type ChoiceWrite = { source: "bank"; bankId: string; body: string } | { source: "custom"; body: string };

/** upsert는 주·소유자 컬럼 수정 권한이 없어 쓸 수 없다. 있으면 수정, 없으면 추가하고, 동시 요청이 겹치면 수정으로 합친다. */
async function saveChoice(ctx: WeekContext, write: ChoiceWrite): Promise<boolean> {
  const bankId = write.source === "bank" ? write.bankId : null;
  const update = async (id: string) => {
    const { data, error } = await ctx.supabase
      .from("week_question_choices")
      .update({ source: write.source, bank_question_id: bankId, body: write.body })
      .eq("id", id)
      .eq("user_id", ctx.userId)
      .select("id");
    if (error || !data || data.length !== 1) {
      console.error("[choices] 질문 선택 수정 실패", error?.code ?? "no-row");
      return false;
    }
    return true;
  };

  const find = () =>
    ctx.supabase
      .from("week_question_choices")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("weekly_question_id", ctx.week.id)
      .maybeSingle();

  const { data: existing, error: findError } = await find();
  if (findError) {
    console.error("[choices] 질문 선택 확인 실패", findError.code);
    return false;
  }
  if (existing) return update(existing.id);

  const { error } = await ctx.supabase.from("week_question_choices").insert({
    user_id: ctx.userId,
    weekly_question_id: ctx.week.id,
    source: write.source,
    bank_question_id: bankId,
    body: write.body,
  });
  if (error?.code === "23505") {
    const { data: raced } = await find();
    return raced ? update(raced.id) : false;
  }
  if (error) {
    console.error("[choices] 질문 선택 저장 실패", error.code);
    return false;
  }
  return true;
}

/** 질문 옆 이모티콘을 눌렀을 때: 은행에서 다른 질문 하나로 바꾼다 (이미 답한 질문·지금 질문은 피한다). */
export async function shuffleThisWeekQuestion(): Promise<ChoiceActionResult> {
  const loaded = await loadEditableWeek();
  if (!loaded.ok) return loaded;
  const { ctx } = loaded;

  const { data: bank, error } = await ctx.supabase.from("question_bank").select("id, body");
  if (error || !bank || bank.length === 0) {
    console.error("[choices] 질문 은행 조회 실패", error?.code ?? "empty");
    return { ok: false, error: FAILED };
  }

  const choices = await getMyChoices();
  const currentBody = choices.get(ctx.week.id)?.body ?? ctx.week.body;
  // 이미 기록한 주의 질문과 기본 질문, 지금 질문은 다시 나오지 않게 한다 (답한 질문을 또 받는 일을 줄인다).
  const exclude = new Set<string>([ctx.week.body, currentBody]);
  const child = await getMyChild();
  if (child) {
    for (const entry of await getMyEntries(child.id)) exclude.add(entry.question.body);
  }

  const picked = pickRandomBankQuestion({ bank, excludeBodies: exclude, currentBody });
  if (!picked) return { ok: false, error: "바꿀 수 있는 다른 질문이 없어요." };

  if (!(await saveChoice(ctx, { source: "bank", bankId: picked.id, body: picked.body }))) {
    return { ok: false, error: FAILED };
  }
  revalidatePath("/", "layout");
  return { ok: true, question: { body: picked.body, source: "bank" } };
}

/** 부모가 직접 쓴 질문을 이번 주 질문으로 정한다. */
export async function setCustomThisWeekQuestion(input: { body: string }): Promise<ChoiceActionResult> {
  const parsed = validateCustomQuestion(input.body);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const loaded = await loadEditableWeek();
  if (!loaded.ok) return loaded;

  if (!(await saveChoice(loaded.ctx, { source: "custom", body: parsed.value }))) {
    return { ok: false, error: FAILED };
  }
  revalidatePath("/", "layout");
  return { ok: true, question: { body: parsed.value, source: "custom" } };
}

/** 바꾼 질문을 지우고 모두에게 같은 기본 질문으로 되돌린다. */
export async function resetThisWeekQuestion(): Promise<ChoiceActionResult> {
  const loaded = await loadEditableWeek();
  if (!loaded.ok) return loaded;
  const { ctx } = loaded;

  const { error } = await ctx.supabase
    .from("week_question_choices")
    .delete()
    .eq("user_id", ctx.userId)
    .eq("weekly_question_id", ctx.week.id);
  if (error) {
    console.error("[choices] 질문 되돌리기 실패", error.code);
    return { ok: false, error: FAILED };
  }
  revalidatePath("/", "layout");
  return { ok: true, question: { body: ctx.week.body, source: null } };
}
