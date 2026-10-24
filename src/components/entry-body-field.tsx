"use client";

import { useId } from "react";
import { ENTRY_BODY_MAX_LENGTH } from "@/lib/entry-validation";

const MAX_LABEL = ENTRY_BODY_MAX_LENGTH.toLocaleString("ko-KR");

const BORDER_CLASS = {
  blush: "border-blush-deep",
  paper: "border-ink",
} as const;

// 기록 본문 입력칸 (글자 수 안내 포함). 홈·이메일 딥링크의 이번 주 카드와 상세 화면의 수정이 함께 쓴다.
// 저장 상태·오류 문구는 쓰는 쪽이 `status` 영역에 보여준다.
export function EntryBodyField({
  value,
  onChange,
  textareaRef,
  rows = 5,
  tone,
  status,
}: {
  value: string;
  onChange: (value: string) => void;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  rows?: number;
  tone: keyof typeof BORDER_CLASS;
  /** 글자 수 옆에 나오는 저장 상태·오류 안내 */
  status?: React.ReactNode;
}) {
  const textareaId = useId();
  const helpId = useId();
  const length = [...value].length;
  const tooLong = length > ENTRY_BODY_MAX_LENGTH;

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={textareaId} className="sr-only">
        우리 아이의 이야기
      </label>
      <textarea
        id={textareaId}
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        aria-describedby={helpId}
        aria-invalid={tooLong}
        placeholder="떠오르는 대로 편하게 적어 주세요."
        className={`w-full resize-y border bg-sheet p-4 font-serif text-base leading-[1.9] text-ink outline-none placeholder:text-ink-mute focus:border-brand focus:ring-1 focus:ring-brand ${BORDER_CLASS[tone]}`}
      />
      <div className="flex items-center justify-between gap-3 text-xs">
        <p aria-live="polite" className="min-h-4">
          {status}
          {tooLong && (
            <span role="alert" className="text-brand-deep">
              {MAX_LABEL}자 이하로 줄여 주세요.
            </span>
          )}
        </p>
        <p id={helpId} className={tooLong ? "text-brand-deep" : "text-ink-mute"}>
          {length.toLocaleString("ko-KR")} / {MAX_LABEL}자
        </p>
      </div>
    </div>
  );
}

/** 본문이 저장 가능한 상태인지 (입력칸 옆 버튼 활성화용). 최종 검증은 서버가 한다. */
export function canSubmitBody(value: string): boolean {
  return value.trim().length > 0 && [...value].length <= ENTRY_BODY_MAX_LENGTH;
}
