"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { submitLogin, type LoginState } from "@/app/actions/auth";
import { resendWaitSeconds } from "@/lib/resend-wait";

const primaryButton =
  "flex min-h-12 w-full items-center justify-between rounded-xl bg-brand px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-mute disabled:opacity-60";
const secondaryButton =
  "min-h-11 px-1 text-sm text-ink-soft underline underline-offset-4 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60";
const fieldClass =
  "w-full border border-ink bg-sheet px-4 py-3 text-base outline-none placeholder:text-ink-mute focus:border-brand focus:ring-1 focus:ring-brand rounded-xl";
const labelClass =
  "text-[11px] font-semibold tracking-[0.14em] text-ink-soft uppercase";

// 보낸 시각(sentAt)부터 남은 대기 시간(초). 1초마다 갱신한다.
function useResendCountdown(sentAt: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (sentAt === undefined) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [sentAt]);
  return resendWaitSeconds(sentAt, now);
}

// 이메일 입력 → 메일로 받은 숫자 코드 입력의 2단계 폼.
// 서버 액션이 단계·오류를 돌려주고, 보내는 중에는 버튼을 막아 중복 제출을 방지한다.
export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    submitLogin,
    { step: "email", email: "", next },
  );
  const emailId = useId();
  const codeId = useId();
  const messageId = useId();
  const waitSeconds = useResendCountdown(state.step === "code" ? state.sentAt : undefined);

  if (state.step === "email") {
    return (
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="intent" value="send" />
        <input type="hidden" name="next" value={state.next} />
        <div className="flex flex-col gap-2">
          <label htmlFor={emailId} className={labelClass}>
            이메일
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            defaultValue={state.email}
            placeholder="parent@example.com"
            aria-invalid={Boolean(state.error)}
            aria-describedby={messageId}
            className={fieldClass}
          />
        </div>
        <div id={messageId} aria-live="polite" className="min-h-6 text-sm">
          {state.error && (
            <p role="alert" className="text-brand">
              {state.error}
            </p>
          )}
        </div>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "코드를 보내는 중…" : "로그인 코드 받기"}
          <span aria-hidden>↗</span>
        </button>
        <p className="text-xs leading-relaxed text-ink-mute">
          처음이라면 이 이메일로 계정이 만들어져요. 비밀번호는 필요 없고, 메일로 받은 숫자 코드만 입력하면 돼요.
        </p>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="intent" value="verify" />
        <input type="hidden" name="next" value={state.next} />
        <input type="hidden" name="email" value={state.email} />
        {state.sentAt !== undefined && <input type="hidden" name="sentAt" value={state.sentAt} />}
        <div className="leading-relaxed text-ink-soft">
          <p>
            <strong className="font-semibold text-ink break-all">{state.email}</strong>
            (으)로 인증 코드를 보냈어요.
          </p>
          <ul className="mt-2 list-disc pl-5 text-[13px]">
            <li>몇 분 안에 도착해요. 메일이 안 보이면 스팸함(프로모션함)도 확인해 주세요.</li>
            <li>코드는 보낸 뒤 일정 시간이 지나면 쓸 수 없어요. 만료되면 새 코드를 받아 주세요.</li>
            <li>이메일 주소가 틀렸다면 아래에서 수정할 수 있어요.</li>
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={codeId} className={labelClass}>
            인증 코드
          </label>
          <input
            id={codeId}
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            maxLength={10}
            autoFocus
            required
            placeholder="숫자 코드"
            aria-invalid={Boolean(state.error)}
            aria-describedby={messageId}
            className={`${fieldClass} text-center font-serif text-2xl tracking-[0.3em]`}
          />
        </div>
        <div id={messageId} aria-live="polite" className="min-h-6 text-sm">
          {state.error && (
            <p role="alert" className="text-brand">
              {state.error}
            </p>
          )}
          {!state.error && state.notice && (
            <p className="text-ink-soft">{state.notice}</p>
          )}
        </div>
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "확인하는 중…" : "로그인"}
          <span aria-hidden>↗</span>
        </button>
      </form>

      <div className="flex flex-wrap gap-x-5 border-t border-line pt-2">
        <form action={formAction}>
          <input type="hidden" name="intent" value="resend" />
          <input type="hidden" name="next" value={state.next} />
          <input type="hidden" name="email" value={state.email} />
          {state.sentAt !== undefined && <input type="hidden" name="sentAt" value={state.sentAt} />}
          <button type="submit" disabled={pending || waitSeconds > 0} className={secondaryButton}>
            {waitSeconds > 0 ? `코드 다시 받기 (${waitSeconds}초 뒤 가능)` : "코드 다시 받기"}
          </button>
        </form>
        <form action={formAction}>
          <input type="hidden" name="intent" value="change" />
          <input type="hidden" name="next" value={state.next} />
          <input type="hidden" name="email" value={state.email} />
          <button type="submit" disabled={pending} className={secondaryButton}>
            이메일 주소 수정
          </button>
        </form>
      </div>
    </div>
  );
}
