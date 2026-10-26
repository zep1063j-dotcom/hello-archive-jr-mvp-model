// 매년 같은 질문 답 검증 (D-026). 실행: npm run test:yearly
// src/app/actions/yearly.ts 가 쓰는 쿼리 모양을 서로 다른 두 부모 계정으로 실행한다.
// 필요: 마이그레이션 20261026000100 이 적용된 개발용 프로젝트. 임시 사용자를 만들고 끝나면 지운다 (service role 키 사용).
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";

type Db = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publishableKey || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY 가 필요하다 (.env.local).");
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service: Db = createClient<Database>(url, serviceKey, clientOptions);
const THIS_YEAR = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric" }).format(new Date()));

type TestUser = { id: string; client: Db; childId: string };

async function createTestUser(label: string): Promise<TestUser> {
  const email = `yearly-test-${label}-${randomBytes(6).toString("hex")}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  assert.ok(created.data.user);
  const client: Db = createClient<Database>(url!, publishableKey!, clientOptions);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  const child = await client
    .from("children")
    .insert({ user_id: created.data.user.id, nickname: label, birth_date: "2022-05-14" })
    .select("id")
    .single();
  assert.ifError(child.error);
  return { id: created.data.user.id, client, childId: child.data!.id };
}

const insertAnswer = (user: TestUser, year: number, key: string, body: string, child = user.childId) =>
  user.client
    .from("yearly_answers")
    .insert({ user_id: user.id, child_id: child, year, question_key: key, body })
    .select("id");

describe("매년 같은 질문 답 (두 부모 계정)", () => {
  let A: TestUser;
  let B: TestUser;

  before(async () => {
    A = await createTestUser("a");
    B = await createTestUser("b");
  });
  after(async () => {
    if (A) await service.auth.admin.deleteUser(A.id);
    if (B) await service.auth.admin.deleteUser(B.id);
  });

  it("A는 올해와 지난 연도의 답을 질문별로 하나씩 저장하고 읽는다", async () => {
    assert.ifError((await insertAnswer(A, THIS_YEAR, "growth", "키 100cm")).error);
    assert.ifError((await insertAnswer(A, THIS_YEAR - 1, "growth", "키 90cm")).error);
    assert.ifError((await insertAnswer(A, THIS_YEAR, "dream", "의사")).error);
    const read = await A.client
      .from("yearly_answers")
      .select("year, question_key, body")
      .eq("user_id", A.id)
      .eq("child_id", A.childId)
      .order("year", { ascending: false });
    assert.ifError(read.error);
    assert.equal(read.data?.length, 3);
  });

  it("같은 연도·질문 두 번째 저장은 유니크 위반(23505)이다 (액션은 이를 수정으로 처리)", async () => {
    const again = await insertAnswer(A, THIS_YEAR, "growth", "중복");
    assert.equal(again.error?.code, "23505");
  });

  it("본문만 수정할 수 있고 연도·질문·소유자는 못 바꾼다", async () => {
    const ok = await A.client
      .from("yearly_answers")
      .update({ body: "키 101cm" })
      .eq("user_id", A.id)
      .eq("year", THIS_YEAR)
      .eq("question_key", "growth")
      .select("id");
    assert.ifError(ok.error);
    assert.equal(ok.data?.length, 1);
    const year = await A.client.from("yearly_answers").update({ year: THIS_YEAR - 2 } as never).eq("user_id", A.id);
    assert.ok(year.error, "year 수정은 GRANT가 막아야 한다");
    const owner = await A.client.from("yearly_answers").update({ user_id: B.id } as never).eq("user_id", A.id);
    assert.ok(owner.error, "user_id 수정은 GRANT가 막아야 한다");
  });

  it("B는 A의 답을 읽지 못하고, A의 자녀에 쓰거나 A의 답을 고치지 못한다", async () => {
    const list = await B.client.from("yearly_answers").select("id");
    assert.ifError(list.error);
    assert.deepEqual(list.data, []);
    const intoA = await B.client
      .from("yearly_answers")
      .insert({ user_id: B.id, child_id: A.childId, year: THIS_YEAR, question_key: "favorites", body: "남의 자녀" });
    assert.ok(intoA.error, "복합 FK가 막아야 한다");
    const spoof = await B.client
      .from("yearly_answers")
      .insert({ user_id: A.id, child_id: A.childId, year: THIS_YEAR, question_key: "favorites", body: "속임" });
    assert.ok(spoof.error, "RLS가 막아야 한다");
    const edit = await B.client.from("yearly_answers").update({ body: "남이 바꿈" }).eq("user_id", A.id).select("id");
    assert.ifError(edit.error);
    assert.equal(edit.data?.length, 0);
    const del = await B.client.from("yearly_answers").delete().eq("user_id", A.id).select("id");
    assert.ifError(del.error);
    assert.equal(del.data?.length, 0);
  });

  it("미래 연도·범위 밖 연도·공백·긴 본문·잘못된 키는 DB도 거부한다", async () => {
    assert.ok((await insertAnswer(B, THIS_YEAR + 1, "growth", "미래")).error, "미래 연도 불가");
    assert.ok((await insertAnswer(B, 1999, "growth", "너무 옛날")).error, "2000년 이전 불가");
    assert.ok((await insertAnswer(B, THIS_YEAR, "growth", "   ")).error, "공백만 불가");
    assert.ok((await insertAnswer(B, THIS_YEAR, "growth", "가".repeat(1001))).error, "1001자 불가");
    assert.ok((await insertAnswer(B, THIS_YEAR, "Bad Key", "키 형식")).error, "키 형식 불가");
  });

  it("A는 답을 지울 수 있고, 부모 계정을 지우면 답도 함께 지워진다", async () => {
    const del = await A.client
      .from("yearly_answers")
      .delete()
      .eq("user_id", A.id)
      .eq("year", THIS_YEAR)
      .eq("question_key", "dream")
      .select("id");
    assert.ifError(del.error);
    assert.equal(del.data?.length, 1);

    await service.auth.admin.deleteUser(A.id);
    const left = await service.from("yearly_answers").select("id").eq("user_id", A.id);
    assert.ifError(left.error);
    assert.deepEqual(left.data, []);
  });
});
