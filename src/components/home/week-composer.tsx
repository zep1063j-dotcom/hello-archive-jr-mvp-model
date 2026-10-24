"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatKoreanDate, formatWeekLabel } from "@/lib/date";
import type { Entry, WeeklyQuestion } from "@/types/archive";

const MAX_LENGTH = 5000;

type SaveStatus = "idle" | "saving" | "error";

// 홈에서 바로 쓰는 이번 주 기록 카드. 접힘(프롬프트) → 작성 → 저장됨(보기) 상태를 오간다.
// 저장은 목 단계라 부모의 onSave로 상태만 올린다. (실제 저장은 SESSION 05)
export function WeekComposer({
  question,
  entry,
  simulateError,
  onSave,
}: {
  question: WeeklyQuestion;
  entry: Entry | null;
  simulateError: boolean;
  onSave: (body: string) => void;
}) {
  const textareaId = useId();
  const helpId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  const tooLong = body.length > MAX_LENGTH;
  const canSubmit = body.trim().length > 0 && !tooLong && status !== "saving";

  function startWriting() {
    if (entry && !open) setBody(entry.body);
    setStatus("idle");
    setOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return; // 저장 중 중복 제출 방지
    setStatus("saving");
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (simulateError) {
      setStatus("error");
      return;
    }
    onSave(body.trim());
    setStatus("idle");
    setOpen(false);
    setBody("");
  }

  const draftPreview = body.trim();

  return (
    <section aria-labelledby="this-week" className="border border-blush-deep bg-blush text-ink">
      <div className="px-5 pt-6 pb-5 md:px-7">
        <p
          id="this-week"
          className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-ink-soft uppercase"
        >
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${entry ? "bg-ink-mute" : "animate-pulse bg-brand"}`}
          />
          {formatWeekLabel(question.weekStart)} · {entry ? "기록 완료" : "이번 주의 질문"}
        </p>
        <p className="mt-4 font-serif text-[1.5rem] leading-[1.55] font-semibold md:text-[1.75rem]">
          {question.body}
        </p>
        {!open && !entry && question.hint && (
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">{question.hint}</p>
        )}
      </div>

      {open ? (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-3 px-5 pb-5 md:px-7"
        >
          <label htmlFor={textareaId} className="sr-only">
            우리 아이의 이야기
          </label>
          <textarea
            id={textareaId}
            ref={textareaRef}
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              if (status === "error") setStatus("idle");
            }}
            rows={5}
            aria-describedby={helpId}
            aria-invalid={tooLong}
            placeholder="떠오르는 대로 편하게 적어 주세요."
            className="w-full resize-y border border-blush-deep bg-sheet p-4 font-serif text-base leading-[1.9] text-ink outline-none placeholder:text-ink-mute focus:border-brand focus:ring-1 focus:ring-brand"
          />
          <div className="flex items-center justify-between gap-3 text-xs">
            <p aria-live="polite" className="min-h-4">
              {status === "saving" && <span className="text-ink-soft">저장하는 중…</span>}
              {status === "error" && (
                <span role="alert" className="text-brand-deep">
                  저장하지 못했어요. 쓴 내용은 그대로 있어요. 다시 눌러 주세요.
                </span>
              )}
              {tooLong && (
                <span role="alert" className="text-brand-deep">
                  {MAX_LENGTH.toLocaleString("ko-KR")}자 이하로 줄여 주세요.
                </span>
              )}
            </p>
            <p id={helpId} className={tooLong ? "text-brand-deep" : "text-ink-mute"}>
              {body.length.toLocaleString("ko-KR")} / {MAX_LENGTH.toLocaleString("ko-KR")}자
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex min-h-12 flex-1 items-center justify-between bg-brand px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-brand"
            >
              {status === "saving" ? "저장하는 중…" : entry ? "수정 저장" : "저장하기"}
              <span aria-hidden>↗</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setStatus("idle");
                if (entry) setBody("");
              }}
              className="min-h-12 border border-ink/30 px-4 text-sm hover:border-ink hover:bg-sheet"
            >
              닫기
            </button>
          </div>
        </form>
      ) : entry ? (
        <div className="flex flex-col gap-4 border-t border-blush-deep px-5 py-5 md:px-7">
          <p className="line-clamp-4 font-serif leading-[1.85] text-ink">{entry.body}</p>
          <div className="flex items-center justify-between gap-3 text-xs text-ink-soft">
            <p>
              <span aria-hidden className="mr-1 text-brand">✓</span>
              {formatKoreanDate(entry.updatedAt)} 저장
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
