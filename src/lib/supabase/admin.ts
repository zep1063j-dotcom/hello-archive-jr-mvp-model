import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

// service role 클라이언트: RLS를 우회한다. 예약 실행(주간 이메일)처럼 사용자 세션이 없는
// 서버 작업에서만 쓴다. 브라우저 코드와, 로그인한 사용자의 요청을 처리하는 서버 액션에서는 쓰지 않는다.
// 예외 하나: 메일의 수신 거부 링크(actions/unsubscribe.ts)는 세션이 없고 서명 검증을 통과했을 때만
// 수신 동의 끄기 한 가지에 쓴다 (D-024).
// 키는 서버 전용 환경 변수이며 NEXT_PUBLIC_ 접두사를 붙이지 않는다.
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았어요.");
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
