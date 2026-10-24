import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

// service role 클라이언트: RLS를 우회한다. 예약 실행(주간 이메일)처럼 사용자 세션이 없는
// 서버 작업에서만 쓰고, 브라우저 코드·서버 액션(사용자 요청)에서는 쓰지 않는다.
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
