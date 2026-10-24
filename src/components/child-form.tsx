"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import {
  createChild,
  updateChild,
  type ChildFormState,
} from "@/app/actions/children";
import { NICKNAME_MAX_LENGTH } from "@/lib/child-validation";

const primaryButton =
  "flex min-h-12 w-full items-center justify-between bg-brand px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-mute disabled:opacity-60";
const fieldClass =
  "w-full border border-ink bg-sheet px-4 py-3 text-base outline-none placeholder:text-ink-mute focus:border-brand focus:ring-1 focus:ring-brand";
const labelClass =
  "text-[11px] font-semibold tracking-[0.14em] text-ink-soft uppercase";

// 자녀 등록(온보딩)과 수정(프로필)이 함께 쓰는 폼. 검증은 서버 액션이 하고, 여기서는 보여주기만 한다.
// 보내는 중에는 버튼을 막아 중복 제출을 방지한다.
export function ChildForm({
  mode,
  initial,
  next,
  min,
  max,
}: {
  mode: "create" | "update";
  initial: { nickname: string; birthDate: string };
  /** create에서 등록 후 돌아갈 경로 */
  next?: string;
  /** 생년월일 입력 범위 (YYYY-MM-DD). 서버가 다시 검증한다. */
  min: string;
  max: string;
}) {
  const [state, formAction, pending] = useActionState<ChildFormState, FormData>(
    mode === "create" ? createChild : updateChild,
    { values: initial },
  );
  const nicknameId = useId();
  const birthId = useId();
  const nicknameErrorId = useId();
  const birthErrorId = useId();
  const formErrorId = useId();
  const { fieldErrors } = state;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {mode === "create" && <input type="hidden" name="next" value={next ?? ""} />}

      <div className="flex flex-col gap-2">
        <label htmlFor={nicknameId} className={labelClass}>
          아이 별명
        </label>
        <input
          id={nicknameId}
          name="nickname"
          type="text"
          autoComplete="off"
          autoFocus={mode === "create"}
          required
          maxLength={NICKNAME_MAX_LENGTH}
          defaultValue={state.values.nickname}
          placeholder="예: 콩이"
          aria-invalid={Boolean(fieldErrors?.nickname)}
          aria-describedby={fieldErrors?.nickname ? nicknameErrorId : undefined}
          className={fieldClass}
        />
        <p
          id={nicknameErrorId}
          aria-live="polite"
          className="min-h-5 text-sm text-brand"
        >
          {fieldErrors?.nickname}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={birthId} className={labelClass}>
          생년월일
        </label>
        <input
          id={birthId}
          name="birthDate"
          type="date"
          required
          min={min}
          max={max}
          defaultValue={state.values.birthDate}
          aria-invalid={Boolean(fieldErrors?.birthDate)}
          aria-describedby={fieldErrors?.birthDate ? birthErrorId : undefined}
          className={`${fieldClass} min-h-12`}
        />
        <p
          id={birthErrorId}
          aria-live="polite"
          className="min-h-5 text-sm text-brand"
        >
          {fieldErrors?.birthDate}
        </p>
      </div>

      <div id={formErrorId} aria-live="polite">
        {state.error && (
          <p role="alert" className="border-l-4 border-brand bg-sheet px-4 py-3 text-sm">
            {state.error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending
            ? "저장하는 중…"
            : mode === "create"
              ? "시작하기"
              : "저장하기"}
          <span aria-hidden>↗</span>
        </button>
        {mode === "update" && (
          <Link
            href="/profile"
            className="flex min-h-12 items-center justify-center border border-line text-ink-soft hover:border-ink hover:text-ink"
          >
            취소
          </Link>
        )}
      </div>
    </form>
  );
}
