// 주간 이메일 수신 거부 링크. Next.js에 묶이지 않는 순수 TS (D-015). 정책은 D-024.
// 링크 = `/unsubscribe?u=<부모 id>&t=<서명>`. 서명은 부모 id에 대한 HMAC이라 다른 사람의 링크를 만들 수 없다.
//  - 이 링크로 할 수 있는 일은 "그 부모의 수신 동의 끄기" 하나뿐이다. 로그인·데이터 열람 권한은 없다(로그인 토큰이 아님).
//  - 메일 보안 스캐너가 링크를 미리 열어도 꺼지지 않도록, 링크를 여는 것(GET)은 확인 화면만 보이고 버튼(POST)을 눌러야 꺼진다.
//  - 만료는 두지 않는다(오래된 메일의 수신 거부도 동작해야 한다). 서명 키는 `CRON_SECRET`을 용도 접두사로 나눠 쓴다.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUserId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function signUnsubscribe(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`unsubscribe:v1:${userId.toLowerCase()}`).digest("hex");
}

export function verifyUnsubscribe(userId: string, token: string, secret: string): boolean {
  if (!secret || !isUserId(userId)) return false;
  const expected = Buffer.from(signUnsubscribe(userId, secret));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** 메일에 넣을 링크. `appUrl`은 끝 슬래시 없이 받는다. */
export function buildUnsubscribeUrl(appUrl: string, userId: string, secret: string): string {
  const token = signUnsubscribe(userId, secret);
  return `${appUrl}/unsubscribe?u=${encodeURIComponent(userId)}&t=${token}`;
}

export type UnsubscribeResult = { ok: true } | { ok: false; reason: "invalid" | "failed" };

/**
 * 서명을 확인하고 그 부모의 수신 동의를 끈다. 사용자 세션이 없어 service role 클라이언트를 받는다.
 * 이미 꺼져 있어도 성공으로 본다(같은 링크를 두 번 눌러도 안전).
 */
export async function unsubscribeWithToken(options: {
  db: SupabaseClient<Database>;
  userId: string;
  token: string;
  secret: string;
}): Promise<UnsubscribeResult> {
  const { db, userId, token, secret } = options;
  if (!verifyUnsubscribe(userId, token, secret)) return { ok: false, reason: "invalid" };
  const { error } = await db
    .from("parent_settings")
    .update({ email_consent: false })
    .eq("user_id", userId.toLowerCase());
  if (error) return { ok: false, reason: "failed" };
  return { ok: true };
}
