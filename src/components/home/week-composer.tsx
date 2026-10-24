"use client";

import { useEffect, useRef, useState } from "react";
import { saveThisWeekEntry } from "@/app/actions/entries";
import { canSubmitBody, EntryBodyField } from "@/components/entry-body-field";
import { formatKoreanDate, formatWeekLabel } from "@/lib/date";
import type { Entry, WeeklyQuestion } from "@/types/archive";

type SaveStatus = "idle" | "saving" | "error";

const NETWORK_ERROR = "저장하지 못했어요. 쓴 내용은 그대로 있어요. 잠시 후 다시 눌러 주세요.";

// 이번 주 기록 카드(홈, 이메일 딥링크 `/write`). 접힘(프롬프트) → 작성 → 저장됨(보기) 상태를 오간다.
// 저장은 서버 액션이 하며(이번 주 질문 검증·같은 주 재작성은 수정), 성공하면 서버 데이터가 갱신돼 entry가 바뀐다.
export function WeekComposer({
  question,
  entry,
  defaultOpen = false,
}: {
  question: WeeklyQuestion;
  entry: Entry | null;
  /** 이메일 딥링크처럼 바로 쓰러 온 화면에서는 작성 칸을 펼쳐 둔다. */
  defaultOpen?: boolean;
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

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  const canSubmit = canSubmitBody(body) && status !== "saving";

  function startWriting() {
    if (shownBody !== null && !open) setBody(shownBody);
    setStatus("idle");
    setOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return; // 저장 중 중복 제출 방지
    setStatus("saving");
    try {
      const result = await saveThisWeekEntry({ weeklyQuestionId: question.id, body });
      if (!result.ok) {
        setErrorMessage(result.error);
        setStatus("error");
        return;
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
  }

  const draftPreview = body.trim();
  const hasEntry = shownBody !== null;

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
          {formatWeekLabel(question.weekStart)} · {hasEntry ? "기록 완료" : "이번 주의 질문"}
        </p>
        <h2 className="mt-4 font-serif text-[1.5rem] leading-[1.55] font-semibold md:text-[1.75rem]">
          {question.body}
        </h2>
        {!hasEntry && question.hint && (
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{question.hint}</p>
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
