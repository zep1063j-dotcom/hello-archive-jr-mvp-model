"use client";

import Link from "next/link";
import { useId, useState } from "react";

const MAX_LENGTH = 5000;

type SaveStatus = "idle" | "saving" | "saved" | "error";

// 목 단계: 실제 저장 없이 저장 중/완료/오류 상태 UI만 보여준다. (저장은 SESSION 05)
export function WriteForm({
  initialBody = "",
  simulateError = false,
}: {
  initialBody?: string;
  simulateError?: boolean;
}) {
  const textareaId = useId();
  const helpId = useId();
  const [body, setBody] = useState(initialBody);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const isEditing = initialBody.length > 0;

  const trimmedLength = body.trim().length;
  const tooLong = body.length > MAX_LENGTH;
  const canSubmit = trimmedLength > 0 && !tooLong && status !== "saving";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return; // 저장 중 중복 제출 방지
    setStatus("saving");
    await new Promise((resolve) => setTimeout(resolve, 800));
    setStatus(simulateError ? "error" : "saved");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <label
          htmlFor={textareaId}
          className="text-[11px] font-semibold tracking-[0.14em] text-ink-soft uppercase"
        >
          우리 아이의 이야기
        </label>
        <textarea
          id={textareaId}
          name="body"
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            if (status === "saved" || status === "error") setStatus("idle");
          }}
          rows={6}
          aria-describedby={helpId}
          aria-invalid={tooLong}
          placeholder="떠오르는 대로 편하게 적어 주세요."
          className="w-full resize-y border border-ink bg-sheet p-4 font-serif text-base leading-[1.9] outline-none placeholder:text-ink-mute focus:border-brand focus:ring-1 focus:ring-brand"
        />
        <p
          id={helpId}
          className={`text-right text-xs ${tooLong ? "text-brand" : "text-ink-mute"}`}
        >
          {body.length.toLocaleString("ko-KR")} / {MAX_LENGTH.toLocaleString("ko-KR")}자
        </p>
      </div>

      <div aria-live="polite" className="min-h-6 text-sm">
        {status === "saving" && <p className="text-ink-soft">저장하는 중…</p>}
        {status === "saved" && (
          <p className="font-medium text-ink">
            저장했어요.{" "}
            <Link href="/archive" className="text-brand underline underline-offset-4">
              아카이브에서 보기
            </Link>
          </p>
        )}
        {status === "error" && (
          <p role="alert" className="text-brand">
            저장하지 못했어요. 쓴 내용은 그대로 남아 있어요. 잠시 후 다시 눌러 주세요.
          </p>
        )}
        {tooLong && (
          <p role="alert" className="text-brand">
            {MAX_LENGTH.toLocaleString("ko-KR")}자 이하로 줄여 주세요.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex min-h-12 items-center justify-between bg-brand px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-mute disabled:opacity-60"
      >
        {status === "saving" ? "저장하는 중…" : isEditing ? "수정 저장" : "저장하기"}
        <span aria-hidden>↗</span>
      </button>
    </form>
  );
}
