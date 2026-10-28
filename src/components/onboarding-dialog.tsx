"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { registerChild } from "@/app/actions/children";
import { completeOnboarding } from "@/app/actions/onboarding";
import { PrivacyNote } from "@/components/privacy-note";
import { NICKNAME_MAX_LENGTH, validateChildInput, type ChildFieldErrors } from "@/lib/child-validation";
import { clearAllDrafts } from "@/lib/draft-store";

// 첫 가입 환영 온보딩 (D-040): 작은 환영 창 → 같은 창이 커지며 아이 정보 → 등록 완료 환영 창.
// 별도 페이지로 이동하지 않고 한 창(<dialog>)의 크기와 내용만 바뀐다. 모달이라 뒤 화면은 조작되지 않고(inert),
// 배경 클릭·Esc로는 닫히지 않는다. 이탈 수단은 "로그아웃"이다.
// 어느 단계에서 시작할지는 서버가 계정 기준으로 정해 내려준다(initialStep). 새로고침해도 아이가 중복 생성되지 않는다(registerChild가 멱등).

type Step = "welcome" | "form" | "finish";
type Phase = "in" | "out";

const primaryButton =
  "flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-ink-mute disabled:opacity-70";
const fieldClass =
  "w-full rounded-xl border border-ink/40 bg-paper px-4 py-3 text-base outline-none placeholder:text-ink-mute focus:border-brand focus:ring-1 focus:ring-brand";
const labelClass = "text-[13px] font-semibold text-ink";
const quietButton =
  "min-h-11 rounded-lg px-3 text-[13px] text-ink-soft underline underline-offset-4 hover:text-ink disabled:opacity-50";

/** 움직임 줄이기 설정이면 단계 사이 대기를 없앤다 (CSS도 같은 설정에서 애니메이션을 끈다). */
function stepDelay(ms: number): number {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}

export function OnboardingDialog({
  initialStep,
  today,
  minBirthDate,
}: {
  initialStep: "welcome" | "finish";
  /** 오늘(KST, YYYY-MM-DD). 생년월일 검증과 입력 범위에 쓴다 */
  today: string;
  minBirthDate: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const closingRef = useRef(false);
  const busyRef = useRef(false);
  const titleId = useId();
  const descId = useId();
  const nicknameId = useId();
  const birthId = useId();
  const nicknameErrorId = useId();
  const birthErrorId = useId();

  const [step, setStep] = useState<Step>(initialStep);
  const [phase, setPhase] = useState<Phase>("in");
  const [height, setHeight] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);

  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ChildFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [emailConsent, setEmailConsent] = useState(false);

  // 모달로 연다. 열린 동안 뒤 화면의 스크롤을 잠가 창 크기가 바뀔 때 화면이 튀지 않게 한다.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  // 창 높이를 내용에 맞춰 부드럽게 바꾼다(내용이 바뀔 때마다 측정). 화면보다 크면 CSS가 창 안에서 스크롤시킨다.
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const measure = () => setHeight(inner.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  // 단계가 바뀌면 새 제목으로 포커스를 옮긴다(스크린리더가 새 단계를 읽는다).
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  function goTo(next: Step) {
    setPhase("out");
    window.setTimeout(() => {
      setStep(next);
      setPhase("in");
    }, stepDelay(140));
  }

  function focusAfterKeyboard(event: React.FocusEvent<HTMLElement>) {
    const target = event.currentTarget;
    // 모바일 키보드가 올라온 뒤에도 입력란이 창 안에서 보이게 한다.
    window.setTimeout(() => target.scrollIntoView({ block: "nearest", behavior: "smooth" }), 300);
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return; // 중복 클릭·엔터 연타 방지
    setFormError(null);

    const parsed = validateChildInput({ nickname, birthDate }, today);
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      (parsed.fieldErrors.nickname
        ? document.getElementById(nicknameId)
        : document.getElementById(birthId)
      )?.focus();
      return;
    }
    setFieldErrors({});

    busyRef.current = true;
    setPending(true);
    try {
      const result = await registerChild({ nickname, birthDate });
      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        setFormError(result.error ?? null);
        return;
      }
      // 실제로 저장된 뒤에만 다음 창으로 간다.
      goTo("finish");
    } catch {
      setFormError("등록하지 못했어요. 입력한 내용은 그대로 있어요. 인터넷 연결을 확인하고 다시 눌러 주세요.");
    } finally {
      busyRef.current = false;
      setPending(false);
    }
  }

  async function handleStart() {
    if (busyRef.current) return;
    busyRef.current = true;
    setPending(true);
    setFormError(null);
    try {
      const result = await completeOnboarding({ emailConsent });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      // 창이 사라진 뒤에 화면을 새로 읽는다. 홈의 이번 주 질문이 뒤에서 이어진다.
      closingRef.current = true;
      setClosing(true);
      window.setTimeout(() => router.refresh(), stepDelay(280));
    } catch {
      setFormError("시작하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.");
    } finally {
      busyRef.current = false;
      setPending(false);
    }
  }

  const wide = step === "form";
  const labelledBy = `${titleId}-${step}`;
  const describedBy = `${descId}-${step}`;

  return (
    <dialog
      ref={dialogRef}
      className="onboarding-dialog"
      data-closing={closing || undefined}
      data-wide={wide || undefined}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      // Esc로 닫히지 않는다. (일부 브라우저는 Esc를 연달아 누르면 그래도 닫으므로 키 입력도 막고, 그래도 닫히면 다시 연다.)
      onKeyDown={(event) => {
        if (event.key === "Escape") event.preventDefault();
      }}
      onCancel={(event) => event.preventDefault()}
      onClose={() => {
        const dialog = dialogRef.current;
        // 화면을 떠나 창이 사라지는 중이면(연결이 끊김) 다시 열지 않는다.
        if (closingRef.current || !dialog || !dialog.isConnected || dialog.open) return;
        try {
          dialog.showModal();
        } catch {
          // 이미 열려 있거나 연결이 끊긴 경우: 할 일이 없다.
        }
      }}
    >
      <div className="onboarding-panel" style={height === null ? undefined : { height }}>
        <div ref={innerRef} className="onboarding-content" data-phase={phase}>
          {step === "welcome" && (
            <div className="flex flex-col items-center gap-7 px-7 pt-9 pb-7 text-center">
              <span aria-hidden className="font-serif text-4xl leading-none font-bold">
                h<span className="text-brand">·</span>
              </span>
              <div className="flex flex-col gap-3">
                <h2 id={labelledBy} ref={headingRef} tabIndex={-1} className="font-serif text-[1.375rem] leading-snug font-bold text-balance outline-none">
                  안녕하세요, 아카이브 jr입니다.
                </h2>
                <p id={describedBy} className="leading-relaxed text-ink-soft">
                  아이의 생각과 기억을 기록하고
                  <br />
                  함께한 순간을 추억으로 남겨 보세요.
                </p>
              </div>
              <div className="flex w-full flex-col items-center gap-1">
                <button type="button" onClick={() => goTo("form")} className={primaryButton}>
                  아이 등록하기
                </button>
                <LeaveButton />
              </div>
            </div>
          )}

          {step === "form" && (
            <div className="flex flex-col pb-3">
            <form onSubmit={handleRegister} noValidate className="flex flex-col gap-5 px-6 pt-8 pb-2 md:px-7">
              <div className="flex flex-col gap-2">
                <h2 id={labelledBy} ref={headingRef} tabIndex={-1} className="font-serif text-[1.375rem] leading-snug font-bold outline-none">
                  아이를 소개해 주세요.
                </h2>
                <p id={describedBy} className="text-[13px] leading-relaxed text-ink-soft">
                  실명 대신 별명을 사용해도 좋아요.
                  <br />
                  사진은 나중에 추가할 수 있어요.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={nicknameId} className={labelClass}>
                  아이 별명
                </label>
                <input
                  id={nicknameId}
                  type="text"
                  autoComplete="off"
                  enterKeyHint="next"
                  maxLength={NICKNAME_MAX_LENGTH}
                  value={nickname}
                  disabled={pending}
                  onChange={(event) => setNickname(event.target.value)}
                  onFocus={focusAfterKeyboard}
                  placeholder="예: 콩이"
                  aria-invalid={Boolean(fieldErrors.nickname)}
                  aria-describedby={fieldErrors.nickname ? nicknameErrorId : undefined}
                  className={fieldClass}
                />
                <p id={nicknameErrorId} aria-live="polite" className="min-h-4 text-[13px] text-brand-deep">
                  {fieldErrors.nickname}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={birthId} className={labelClass}>
                  생년월일
                </label>
                <input
                  id={birthId}
                  type="date"
                  min={minBirthDate}
                  max={today}
                  value={birthDate}
                  disabled={pending}
                  onChange={(event) => setBirthDate(event.target.value)}
                  onFocus={focusAfterKeyboard}
                  aria-invalid={Boolean(fieldErrors.birthDate)}
                  aria-describedby={fieldErrors.birthDate ? birthErrorId : undefined}
                  className={`${fieldClass} min-h-12`}
                />
                <p id={birthErrorId} aria-live="polite" className="min-h-4 text-[13px] text-brand-deep">
                  {fieldErrors.birthDate}
                </p>
              </div>

              <PrivacyNote className="rounded-xl bg-paper px-4 py-3" />

              <div aria-live="polite">
                {formError && (
                  <p role="alert" className="rounded-xl border-l-4 border-brand bg-paper px-4 py-3 text-[13px] leading-relaxed">
                    {formError}
                  </p>
                )}
              </div>

              <button type="submit" disabled={pending} className={primaryButton}>
                {pending ? "등록하고 있어요…" : "등록하기"}
              </button>
            </form>
            <div className="flex justify-center">
              <LeaveButton disabled={pending} />
            </div>
            </div>
          )}

          {step === "finish" && (
            <div className="flex flex-col items-center gap-7 px-7 pt-9 pb-7 text-center">
              <span aria-hidden className="font-serif text-4xl leading-none font-bold">
                h<span className="text-brand">·</span>
              </span>
              <div className="flex flex-col gap-3">
                <h2 id={labelledBy} ref={headingRef} tabIndex={-1} className="font-serif text-[1.375rem] leading-snug font-bold outline-none">
                  환영합니다.
                </h2>
                <p id={describedBy} className="leading-relaxed text-ink-soft">
                  매주 하나의 질문으로
                  <br />
                  아이의 성장 자서전을 만들어 보세요.
                </p>
              </div>
              <label className="flex w-full items-start gap-3 rounded-xl bg-paper px-4 py-3 text-left text-[13px] leading-relaxed">
                <input
                  type="checkbox"
                  checked={emailConsent}
                  disabled={pending}
                  onChange={(event) => setEmailConsent(event.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-brand"
                />
                <span>
                  <span className="block font-semibold">매주 월요일 저녁, 이번 주 질문을 이메일로 받을래요</span>
                  <span className="block text-ink-soft">선택 사항이에요. 프로필에서 언제든 끌 수 있어요.</span>
                </span>
              </label>
              <div aria-live="polite" className="w-full">
                {formError && (
                  <p role="alert" className="rounded-xl border-l-4 border-brand bg-paper px-4 py-3 text-left text-[13px] leading-relaxed">
                    {formError}
                  </p>
                )}
              </div>
              <button type="button" onClick={handleStart} disabled={pending || closing} className={primaryButton}>
                {pending || closing ? "시작하고 있어요…" : "시작하기"}
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

// 온보딩 중 나갈 수 있는 유일한 수단. 이 기기의 작성 중인 글도 함께 지운다.
function LeaveButton({ disabled }: { disabled?: boolean }) {
  return (
    <form action={signOut} onSubmit={clearAllDrafts}>
      <button type="submit" disabled={disabled} className={quietButton}>
        다른 계정으로 시작하기 (로그아웃)
      </button>
    </form>
  );
}
