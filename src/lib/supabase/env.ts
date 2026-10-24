// 브라우저에 공개되어도 되는 값만 읽는다. service role 키는 여기서 다루지 않는다.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 가 설정되지 않았어요. .env.local 을 확인하세요.",
    );
  }
  return { url, publishableKey };
}
