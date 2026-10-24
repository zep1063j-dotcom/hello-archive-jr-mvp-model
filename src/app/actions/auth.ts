"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// 로그인 폼 상태. step이 "code"면 메일로 코드를 보낸 뒤 코드 입력 단계다.
export type LoginState = {
  step: "email" | "code";
  email: string;
  next: string;
  error?: string;
  /** 코드를 다시 보냈을 때 알림용 */
  notice?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 코드 길이는 Supabase 대시보드 설정(Email OTP Length)에 따라 6~10자리라서 길이를 고정하지 않는다.
const CODE_PATTERN = /^\d{6,10}$/;

// signInWithOtp는 PKCE용 code-verifier 쿠키를 남기지만, 일회용 코드 확인(verifyOtp)에는 쓰이지 않는다.
// 코드를 보낼 때마다 쌓여 모든 요청에 붙어 다니므로 보내기 전·로그인 후에 지운다.
async function clearCodeVerifierCookies() {
  const cookieStore = await cookies();
  cookieStore
    .getAll()
    .filter(({ name }) => name.endsWith("code-verifier"))
    .forEach(({ name }) => cookieStore.delete(name));
}

function readEmail(formData: FormData) {
  return String(formData.get("email") ?? "").trim().toLowerCase();
}

// 메일로 일회용 숫자 코드를 보낸다. 가입 여부와 관계없이 같은 응답을 준다.
// (가입되지 않은 이메일이면 Supabase가 첫 로그인 때 계정을 만든다.)
async function requestLoginCode(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = readEmail(formData);
  const next = safeNextPath(formData.get("next"));

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { step: "email", email, next, error: "이메일 주소를 다시 확인해 주세요." };
  }

  await clearCodeVerifierCookies();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    // 발송 한도(너무 잦은 요청)와 그 밖의 오류를 구분해 안내한다. 이메일은 로그에 남기지 않는다.
    console.error("[auth] 로그인 코드 발송 실패", error.code ?? error.status);
    const rateLimited =
      error.code === "over_email_send_rate_limit" || error.status === 429;
    const invalidEmail = error.code === "email_address_invalid";
    return {
      step: "email",
      email,
      next,
      error: rateLimited
        ? "코드를 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요."
        : invalidEmail
          ? "사용할 수 없는 이메일 주소예요. 주소를 다시 확인해 주세요."
          : "코드를 보내지 못했어요. 잠시 후 다시 시도해 주세요.",
    };
  }

  return { step: "code", email, next };
}

// 메일의 숫자 코드를 확인해 세션 쿠키를 만들고, 안전하게 검증한 경로로 보낸다.
async function verifyLoginCode(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = readEmail(formData);
  const next = safeNextPath(formData.get("next"));
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");

  if (!EMAIL_PATTERN.test(email)) {
    return { step: "email", email: "", next, error: "처음부터 다시 시도해 주세요." };
  }
  if (!CODE_PATTERN.test(token)) {
    return { step: "code", email, next, error: "메일로 받은 숫자 코드를 입력해 주세요." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error || !data.user) {
    console.error("[auth] 코드 확인 실패", error?.code ?? error?.status);
    return {
      step: "code",
      email,
      next,
      error: "코드가 맞지 않거나 만료됐어요. 새 코드를 받아 다시 입력해 주세요.",
    };
  }

  await clearCodeVerifierCookies();

  // 부모 설정 행(메일 수신 동의 기본값 false)을 처음 로그인할 때 만든다.
  // 이미 있으면 건드리지 않는다. 실패해도 로그인은 막지 않는다(수신 설정은 SESSION 07에서 다시 확인).
  const { error: settingsError } = await supabase
    .from("parent_settings")
    .upsert({ user_id: data.user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  if (settingsError) {
    console.error("[auth] parent_settings 생성 실패", settingsError.code);
  }

  redirect(next);
}

// 코드를 다시 받는다. 입력 단계에서 같은 이메일로 새 코드를 보낸다.
async function resendLoginCode(
  prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const result = await requestLoginCode(prev, formData);
  if (result.step === "code") {
    return { ...result, notice: "새 코드를 보냈어요. 가장 최근에 받은 메일의 코드를 입력해 주세요." };
  }
  // 실패하면 코드 입력 단계를 유지한 채 오류만 보여준다.
  return { ...result, step: "code" };
}

// 로그인 폼의 단일 진입점. intent로 단계를 나눈다: send(코드 받기) / verify(코드 확인) / resend(다시 받기) / change(이메일 바꾸기)
export async function submitLogin(
  prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  switch (formData.get("intent")) {
    case "verify":
      return verifyLoginCode(prev, formData);
    case "resend":
      return resendLoginCode(prev, formData);
    case "change":
      return { step: "email", email: readEmail(formData), next: safeNextPath(formData.get("next")) };
    default:
      return requestLoginCode(prev, formData);
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
