"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { savePastEntry, saveThisWeekEntry } from "@/app/actions/entries";
import {
  resetThisWeekQuestion,
  setCustomThisWeekQuestion,
  shuffleThisWeekQuestion,
  type ChoiceActionResult,
} from "@/app/actions/question-choices";
import { canSubmitBody, EntryBodyField } from "@/components/entry-body-field";
import { EntryPhotoField, PhotoStrip, useEntryPhotos } from "@/components/entry-photo-field";
import { PrivacyNote } from "@/components/privacy-note";
import { useStoredDraft } from "@/components/use-draft";
import { formatKoreanDate, formatWeekLabel } from "@/lib/date";
import { draftKey, removeDraft, writeDraft } from "@/lib/draft-store";
import { CUSTOM_QUESTION_MAX_LENGTH } from "@/lib/question-choice-rules";
import type { Entry, WeeklyQuestion } from "@/types/archive";

type SaveStatus = "idle" | "saving" | "error";

const NETWORK_ERROR = "저장하지 못했어요. 쓴 내용은 그대로 있어요. 잠시 후 다시 눌러 주세요.";

// 이번 주 기록 카드(홈, 이메일 딥링크 `/write`). 접힘(프롬프트) → 작성 → 저장됨(보기) 상태를 오간다.
// 저장은 서버 액션이 하며(이번 주 질문 검증·같은 주 재작성은 수정), 성공하면 서버 데이터가 갱신돼 entry가 바뀐다.
//  - `question`은 호출부가 정한 "이 카드의 질문"이다: 기록이 있으면 저장된 기록의 질문, 없으면 지금 추천 질문 (D-039).
//  - 기록 완료 상태에서는 질문 바꾸기 도구를 감춘다. 수정 흐름 안의 "질문도 바꾸기"를 눌러야 열린다.
//  - 작성 중인 글은 이 기기에 계정별 초안으로 남겨, 새로고침·화면 이동·앱 전환으로 잃지 않게 한다 (D-041).
export function WeekComposer({
  question,
  entry,
  userId,
  firstRecord = false,
  defaultOpen = false,
  past = false,
}: {
  question: WeeklyQuestion;
  entry: Entry | null;
  /** 초안을 계정별로 나누는 데 쓰는 로그인 부모 id */
  userId: string;
  /** 아직 기록이 하나도 없는 부모의 첫 기록: 개인정보 안내를 함께 보인다 */
  firstRecord?: boolean;
  /** 이메일 딥링크처럼 바로 쓰러 온 화면에서는 작성 칸을 펼쳐 둔다. */
  defaultOpen?: boolean;
  /** 놓친 지난 질문에 쓰는 카드 (D-024). 저장은 지난 질문 규칙을 서버가 따로 확인한다. */
  past?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const savingRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState(NETWORK_ERROR);
  // 저장 직후 서버 데이터가 도착하기 전까지 방금 저장한 내용을 보여준다 (옛 본문이 잠깐 보이는 것을 막는다).
  const [savedBody, setSavedBody] = useState<string | null>(null);
  const [seenEntry, setSeenEntry] = useState(entry);
  if (seenEntry !== entry) {
    setSeenEntry(entry);
    setSavedBody(null);
  }
  const shownBody = savedBody ?? entry?.body ?? null;

  // 작성 중인 글: 입력값(typed) → 이 기기의 초안(stored) → (수정 중이면) 저장된 본문 순으로 보여 준다.
  const hasEntry = shownBody !== null;
  const key = draftKey(userId, entry ? `edit:${entry.id}` : `new:${question.id}`);
  const stored = useStoredDraft(key);
  const [typed, setTyped] = useState<string | null>(null);
  const body = typed ?? stored ?? (open && hasEntry ? shownBody : "");
  const restored = stored !== null && typed === null;
  function changeBody(next: string) {
    setTyped(next);
    // 수정 중에 원래 본문과 같아지면 지킬 초안이 없다.
    if (hasEntry && next === shownBody) removeDraft(key);
    else writeDraft(key, next);
    if (status === "error") setStatus("idle");
  }

  // 이번 주 질문 바꾸기 (D-025). 서버가 바뀐 질문을 돌려주면 서버 데이터가 도착하기 전까지 그 문구를 보여 준다.
  const [override, setOverride] = useState<{ body: string; source: "bank" | "custom" | null } | null>(null);
  const [seenQuestion, setSeenQuestion] = useState(question);
  if (seenQuestion !== question) {
    setSeenQuestion(question);
    setOverride(null);
  }
  const photos = useEntryPhotos(entry?.photos ?? []);
  const [choiceBusy, setChoiceBusy] = useState(false);
  const [choiceError, setChoiceError] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  // 기록이 있을 때 질문 바꾸기는 수정 흐름 안에서 이 버튼을 눌러야 열린다.
  const [questionEditOpen, setQuestionEditOpen] = useState(false);
  const questionBody = override?.body ?? question.body;
  const questionSource = override ? override.source : (question.source ?? null);
  const questionHint = override ? undefined : question.hint;

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  const canSubmit = canSubmitBody(body) && status !== "saving" && !photos.busy;

  function startWriting() {
    setStatus("idle");
    setOpen(true);
  }

  function closeEditor() {
    setOpen(false);
    setStatus("idle");
    setQuestionEditOpen(false);
    setCustomOpen(false);
    // 이미 저장된 기록을 고치다 닫으면 고치던 내용을 버리고 저장된 원본을 그대로 둔다. 새 기록은 초안을 남겨 둔다.
    if (hasEntry) {
      setTyped(null);
      removeDraft(key);
    }
  }

  async function runChoice(action: () => Promise<ChoiceActionResult>) {
    if (choiceBusy) return; // 연속 탭 중복 방지
    setChoiceBusy(true);
    setChoiceError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setChoiceError(result.error);
        return;
      }
      setOverride(result.question);
      setCustomOpen(false);
      setCustomText("");
    } catch {
      setChoiceError("질문을 바꾸지 못했어요. 잠시 후 다시 눌러 주세요.");
    } finally {
      setChoiceBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || savingRef.current) return; // 저장 중 중복 제출 방지 (같은 틱의 연속 탭까지)
    savingRef.current = true;
    setStatus("saving");
    try {
      const result = await (past ? savePastEntry : saveThisWeekEntry)({
        weeklyQuestionId: question.id,
        body,
      });
      if (!result.ok) {
        setErrorMessage(result.error);
        setStatus("error");
        return;
      }
      // 글은 서버에 저장됐다: 이 기기의 초안은 더 필요 없다. (사진 올리기가 실패해도 글은 안전하다.)
      removeDraft(key);
      // 글이 저장된 뒤 대기 중인 사진을 한 장씩 올린다. 실패하면 글은 저장된 상태로 두고 다시 누르게 한다 (D-027).
      if (photos.queued.length > 0 && result.entryId) {
        const upload = await photos.uploadQueued(result.entryId);
        if (upload.failed > 0) {
          setErrorMessage(
            `글은 저장했어요. 사진 ${upload.failed}장은 올리지 못했어요. ${upload.message ?? ""} 저장하기를 다시 눌러 주세요.`.trim(),
          );
          setStatus("error");
          return;
        }
      }
    } catch {
      setErrorMessage(NETWORK_ERROR);
      setStatus("error");
      return;
    } finally {
      savingRef.current = false;
    }
    setSavedBody(body.trim());
    setStatus("idle");
    setOpen(false);
    setTyped(null);
    setQuestionEditOpen(false);
    photos.reset();
  }

  const draftPreview = body.trim();
  // 질문 바꾸기 도구: 기록이 없을 땐 바로 보이고, 기록이 있으면 수정 흐름에서 "질문도 바꾸기"를 눌러야 보인다 (D-034, D-039).
  const editingEntry = open && hasEntry && !past;
  const canChangeQuestion = !past && status !== "saving" && (hasEntry ? editingEntry && questionEditOpen : true);

  return (
    <section aria-labelledby="this-week" className="rounded-3xl border border-blush-deep bg-blush text-ink">
      <div className={`px-5 pt-6 md:px-7 ${hasEntry && !open ? "pb-3" : "pb-5"}`}>
        <p
          id="this-week"
          className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-ink-soft uppercase"
        >
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${hasEntry ? "bg-ink-mute" : "animate-pulse bg-brand"}`}
          />
          {formatWeekLabel(question.weekStart)} ·{" "}
          {hasEntry
            ? "기록 완료"
            : past
              ? "지난 질문"
              : questionSource === "custom"
                ? "직접 쓴 질문"
                : questionSource === "bank"
                  ? "바꾼 질문"
                  : "이번 주의 질문"}
        </p>
        <div className={`${hasEntry ? "mt-2" : "mt-4"} flex items-start gap-3`}>
          {/* 기록이 있으면 질문은 작고 차분하게, 답이 주인공이다 (D-047) */}
          <h2
            className={
              hasEntry
                ? "min-w-0 flex-1 text-[0.9375rem] leading-relaxed font-medium text-brand-deep"
                : "min-w-0 flex-1 font-serif text-[1.5rem] leading-[1.55] font-semibold md:text-[1.75rem]"
            }
          >
            {questionBody}
          </h2>
          {canChangeQuestion && (
            <button
              type="button"
              onClick={() => runChoice(shuffleThisWeekQuestion)}
              disabled={choiceBusy}
              aria-label="이번 주 질문을 다른 질문으로 바꾸기"
              className="grid size-11 shrink-0 place-items-center rounded-full border border-blush-deep bg-sheet text-ink-soft transition-transform hover:text-brand active:scale-90 disabled:opacity-60"
            >
              {/* 새로고침(↻) 아이콘. 바꾸는 동안 돈다. */}
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`size-5 ${choiceBusy ? "animate-spin" : ""}`}
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>
          )}
        </div>
        {!hasEntry && questionSource !== "custom" && (
          <p className="mt-3 text-[13px] font-semibold text-ink-soft">
            아이에게 직접 물어보고, 대답을 들은 그대로 적어 주세요.
          </p>
        )}
        {!hasEntry && questionHint && (
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{questionHint}</p>
        )}
        {canChangeQuestion && hasEntry && (
          <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
            질문을 바꾸면 이 기록에 보이는 질문도 함께 바뀌어요. 쓴 답은 그대로 있어요.
          </p>
        )}
        {canChangeQuestion && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-soft">
            <button
              type="button"
              onClick={() => setCustomOpen((value) => !value)}
              disabled={choiceBusy}
              aria-expanded={customOpen}
              className="flex min-h-10 items-center gap-1.5 border border-ink/40 bg-sheet px-3 font-semibold text-ink hover:border-ink disabled:opacity-60 rounded-xl"
            >
              <span aria-hidden>✎</span>
              직접 질문 쓰기
            </button>
            {questionSource !== null && (
              <button
                type="button"
                onClick={() => runChoice(resetThisWeekQuestion)}
                disabled={choiceBusy}
                className="min-h-10 underline underline-offset-4 hover:text-brand disabled:opacity-60"
              >
                기본 질문으로 되돌리기
              </button>
            )}
            <span aria-live="polite" className="text-ink-mute">
              {choiceBusy ? "질문을 바꾸는 중…" : ""}
            </span>
          </div>
        )}
        {choiceError && (
          <p role="alert" className="mt-2 text-sm text-brand-deep">
            {choiceError}
          </p>
        )}
        {canChangeQuestion && customOpen && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              runChoice(() => setCustomThisWeekQuestion({ body: customText }));
            }}
            noValidate
            className="mt-3 flex flex-col gap-2"
          >
            <label htmlFor="custom-question" className="text-sm text-ink-soft">
              우리 아이에게 묻고 싶은 질문 ({customText.length} / {CUSTOM_QUESTION_MAX_LENGTH})
            </label>
            <input
              id="custom-question"
              type="text"
              value={customText}
              maxLength={CUSTOM_QUESTION_MAX_LENGTH}
              onChange={(event) => setCustomText(event.target.value)}
              placeholder="예: 요즘 아이가 가장 좋아하는 놀이는?"
              className="min-h-12 border border-ink/40 bg-paper px-4 focus:border-ink rounded-xl"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={choiceBusy || customText.trim().length === 0}
                className="min-h-11 flex-1 border border-ink px-4 text-sm font-semibold hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 rounded-xl"
              >
                이 질문으로 쓰기
              </button>
              <button
                type="button"
                onClick={() => setCustomOpen(false)}
                className="min-h-11 border border-ink/30 px-4 text-sm hover:border-ink hover:bg-sheet rounded-xl"
              >
                취소
              </button>
            </div>
          </form>
        )}
      </div>

      {open ? (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-3 px-5 pb-5 md:px-7"
        >
          {!hasEntry && (
            <p className="text-[13px] leading-relaxed text-ink-soft">
              한 문장만 적어도 괜찮아요. 사진 없이 글만으로도 기록이 돼요.
            </p>
          )}
          <EntryBodyField
            value={body}
            onChange={changeBody}
            textareaRef={textareaRef}
            tone="blush"
            status={
              <>
                {status === "saving" && <span className="text-ink-soft">저장하는 중…</span>}
                {status === "error" && (
                  <span role="alert" className="text-brand-deep">
                    {errorMessage}
                  </span>
                )}
                {status === "idle" && restored && (
                  <span className="text-ink-soft">작성하던 글을 불러왔어요.</span>
                )}
              </>
            }
          />
          <EntryPhotoField photos={photos} disabled={status === "saving"} />
          {photos.queued.length > 0 && (
            <p className="text-[12px] leading-relaxed text-ink-soft">
              고른 사진은 저장하기 전에 이 화면을 나가면 사라져요. 글은 이 기기에 임시로 남아 있어요.
            </p>
          )}
          {firstRecord && <PrivacyNote />}
          {editingEntry && (
            <button
              type="button"
              onClick={() => setQuestionEditOpen((value) => !value)}
              aria-expanded={questionEditOpen}
              className="self-start rounded-lg py-2 text-[13px] text-ink-soft underline underline-offset-4 hover:text-brand"
            >
              {questionEditOpen ? "질문 바꾸기 닫기" : "질문도 바꾸기"}
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex min-h-12 flex-1 items-center justify-between bg-brand px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-brand rounded-xl"
            >
              {status === "saving" ? "저장하는 중…" : hasEntry ? "수정 저장" : "저장하기"}
              <span aria-hidden>↗</span>
            </button>
            <button
              type="button"
              onClick={closeEditor}
              disabled={status === "saving"}
              className="min-h-12 border border-ink/30 px-4 text-sm hover:border-ink hover:bg-sheet disabled:opacity-40 rounded-xl"
            >
              {hasEntry ? "취소" : "닫기"}
            </button>
          </div>
        </form>
      ) : shownBody !== null ? (
        <div className="flex flex-col gap-4 px-5 pb-5 md:px-7">
          <p className="line-clamp-6 font-serif text-[1.375rem] leading-[1.75] font-medium whitespace-pre-wrap text-ink md:text-[1.5rem]">
            {shownBody}
          </p>
          <PhotoStrip photos={entry?.photos ?? []} />
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-ink-soft">
            <p>
              <span aria-hidden className="mr-1 text-brand">✓</span>
              {entry && savedBody === null
                ? `${formatKoreanDate(entry.updatedAt)} 저장`
                : "방금 저장했어요"}
            </p>
            <div className="flex items-center gap-2">
              {entry && (
                <Link
                  href={`/archive/${entry.id}`}
                  transitionTypes={["nav-forward"]}
                  className="grid min-h-10 place-items-center rounded-lg px-3 text-sm whitespace-nowrap text-ink-soft underline underline-offset-4 hover:text-brand"
                >
                  다시 보기
                </Link>
              )}
              <button
                type="button"
                onClick={startWriting}
                className="min-h-10 rounded-lg border border-ink/30 px-4 text-sm whitespace-nowrap text-ink hover:border-ink hover:bg-sheet"
              >
                수정하기
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 pb-5 md:px-7">
          <button
            type="button"
            onClick={startWriting}
            className="group flex min-h-14 w-full items-center justify-between gap-3 border border-blush-deep bg-sheet px-4 text-left text-ink transition-colors hover:border-brand rounded-xl"
          >
            <span
              className={`line-clamp-1 font-serif ${draftPreview ? "" : "text-ink-mute"}`}
            >
              {draftPreview ? `작성 중: ${draftPreview}` : "여기를 눌러 한 문장만 적어 보세요"}
            </span>
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-white transition-transform group-hover:rotate-12"
            >
              ✎
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
