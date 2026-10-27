"use client";

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
import { formatKoreanDate, formatWeekLabel } from "@/lib/date";
import { CUSTOM_QUESTION_MAX_LENGTH } from "@/lib/question-choice-rules";
import type { Entry, WeeklyQuestion } from "@/types/archive";

type SaveStatus = "idle" | "saving" | "error";

const NETWORK_ERROR = "저장하지 못했어요. 쓴 내용은 그대로 있어요. 잠시 후 다시 눌러 주세요.";

// 이번 주 기록 카드(홈, 이메일 딥링크 `/write`). 접힘(프롬프트) → 작성 → 저장됨(보기) 상태를 오간다.
// 저장은 서버 액션이 하며(이번 주 질문 검증·같은 주 재작성은 수정), 성공하면 서버 데이터가 갱신돼 entry가 바뀐다.
export function WeekComposer({
  question,
  entry,
  defaultOpen = false,
  past = false,
}: {
  question: WeeklyQuestion;
  entry: Entry | null;
  /** 이메일 딥링크처럼 바로 쓰러 온 화면에서는 작성 칸을 펼쳐 둔다. */
  defaultOpen?: boolean;
  /** 놓친 지난 질문에 쓰는 카드 (D-024). 저장은 지난 질문 규칙을 서버가 따로 확인한다. */
  past?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [body, setBody] = useState(defaultOpen && entry ? entry.body : "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState(NETWORK_ERROR);
  // 저장 직후 서버 데이터가 도착하기 전까지 방금 저장한 내용을 보여준다 (옛 본문이 잠깐 보이는 것을 막는다).
  const [savedBody, setSavedBody] = useState<string | null>(null);
  const [seenEntry, setSeenEntry] = useState(entry);
  if (seenEntry !== entry) {
    setSeenEntry(entry);
    setSavedBody(null);
  }
  const shownBody = savedBody ?? entry?.body ?? null;

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
  const questionBody = override?.body ?? question.body;
  const questionSource = override ? override.source : (question.source ?? null);
  const questionHint = override ? undefined : question.hint;

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  const canSubmit = canSubmitBody(body) && status !== "saving" && !photos.busy;

  function startWriting() {
    if (shownBody !== null && !open) setBody(shownBody);
    setStatus("idle");
    setOpen(true);
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
    if (!canSubmit) return; // 저장 중 중복 제출 방지
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
    }
    setSavedBody(body.trim());
    setStatus("idle");
    setOpen(false);
    setBody("");
    photos.reset();
  }

  const draftPreview = body.trim();
  const hasEntry = shownBody !== null;
  // 이번 주 질문만 바꿀 수 있고, 기록을 남기면 그 주 질문은 고정된다 (D-025). 서버·DB도 같은 규칙으로 막는다.
  const canChangeQuestion = !past && !hasEntry && status !== "saving";

  return (
    <section aria-labelledby="this-week" className="border border-blush-deep bg-blush text-ink">
      <div className="px-5 pt-6 pb-5 md:px-7">
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
        <div className="mt-4 flex items-start gap-3">
          <h2 className="min-w-0 flex-1 font-serif text-[1.5rem] leading-[1.55] font-semibold md:text-[1.75rem]">
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
        {!hasEntry && questionHint && (
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{questionHint}</p>
        )}
        {canChangeQuestion && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-soft">
            <button
              type="button"
              onClick={() => setCustomOpen((value) => !value)}
              disabled={choiceBusy}
              aria-expanded={customOpen}
              className="min-h-10 underline underline-offset-4 hover:text-brand disabled:opacity-60"
            >
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
              className="min-h-12 border border-ink/40 bg-paper px-4 focus:border-ink"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={choiceBusy || customText.trim().length === 0}
                className="min-h-11 flex-1 border border-ink px-4 text-sm font-semibold hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
              >
                이 질문으로 쓰기
              </button>
              <button
                type="button"
                onClick={() => setCustomOpen(false)}
                className="min-h-11 border border-ink/30 px-4 text-sm hover:border-ink hover:bg-sheet"
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
          <EntryBodyField
            value={body}
            onChange={(next) => {
              setBody(next);
              if (status === "error") setStatus("idle");
            }}
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
              </>
            }
          />
          <EntryPhotoField photos={photos} disabled={status === "saving"} />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex min-h-12 flex-1 items-center justify-between bg-brand px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-brand"
            >
              {status === "saving" ? "저장하는 중…" : hasEntry ? "수정 저장" : "저장하기"}
              <span aria-hidden>↗</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setStatus("idle");
                if (hasEntry) setBody("");
              }}
              disabled={status === "saving"}
              className="min-h-12 border border-ink/30 px-4 text-sm hover:border-ink hover:bg-sheet disabled:opacity-40"
            >
              닫기
            </button>
          </div>
        </form>
      ) : shownBody !== null ? (
        <div className="flex flex-col gap-4 border-t border-blush-deep px-5 py-5 md:px-7">
          <p className="line-clamp-4 font-serif leading-[1.85] whitespace-pre-wrap text-ink">
            {shownBody}
          </p>
          <PhotoStrip photos={entry?.photos ?? []} />
          <div className="flex items-center justify-between gap-3 text-xs text-ink-soft">
            <p>
              <span aria-hidden className="mr-1 text-brand">✓</span>
              {entry && savedBody === null
                ? `${formatKoreanDate(entry.updatedAt)} 저장`
                : "방금 저장했어요"}
            </p>
            <button
              type="button"
              onClick={startWriting}
              className="min-h-10 border border-ink/30 px-4 text-sm text-ink hover:border-ink hover:bg-sheet"
            >
              수정하기
            </button>
          </div>
        </div>
      ) : (
        <div className="px-5 pb-5 md:px-7">
          <button
            type="button"
            onClick={startWriting}
            className="group flex min-h-14 w-full items-center justify-between gap-3 border border-blush-deep bg-sheet px-4 text-left text-ink transition-colors hover:border-brand"
          >
            <span
              className={`line-clamp-1 font-serif ${draftPreview ? "" : "text-ink-mute"}`}
            >
              {draftPreview ? `작성 중: ${draftPreview}` : "여기를 눌러 바로 적어 보세요"}
            </span>
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center bg-brand text-white transition-transform group-hover:rotate-12"
            >
              ✎
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
