import "server-only";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// 주간 이메일 수신 동의 (기본 거부). 사용자 세션 클라이언트로만 읽고 쓴다 — RLS가 본인 행만 허용하고
// 컬럼 GRANT가 `email_consent`만 수정하게 한다. `consent_updated_at`은 DB 트리거가 기록한다 (D-013, D-022).

/** 로그인한 부모의 수신 동의 여부. 설정 행이 없으면 false. (쿠키를 읽으므로 Suspense 안에서 호출) */
export async function getMyEmailConsent(): Promise<boolean> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parent_settings")
    .select("email_consent")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[consent] 수신 설정 조회 실패", error.code);
    throw new Error("수신 설정을 불러오지 못했어요.");
  }
  return data?.email_consent ?? false;
}

/** 수신 동의를 저장한다. 성공하면 true. 설정 행이 아직 없으면 새로 만든다. */
export async function saveEmailConsent(
  supabase: ServerClient,
  userId: string,
  consent: boolean,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("parent_settings")
    .update({ email_consent: consent })
    .eq("user_id", userId)
    .select("user_id");
  if (error) {
    console.error("[consent] 수신 설정 저장 실패", error.code);
    return false;
  }
  if (data.length === 1) return true;

  // RLS가 걸러냈거나 행이 아직 없다 → 행을 만든다 (RLS가 본인 행만 허용).
  const { error: insertError } = await supabase
    .from("parent_settings")
    .insert({ user_id: userId, email_consent: consent });
  if (insertError && insertError.code !== "23505") {
    console.error("[consent] 수신 설정 생성 실패", insertError.code);
    return false;
  }
  return !insertError;
}
