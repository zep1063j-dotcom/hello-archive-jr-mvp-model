// 제작 관심 표시 검증 (D-036). 실행: npm run test:interests
// src/app/actions/product-interest.ts 가 쓰는 쿼리 모양을 서로 다른 두 부모 계정으로 실행한다.
// 필요: 마이그레이션 20261028000000(또는 supabase/apply/4_product_interests.sql)이 적용된 개발용 프로젝트.
// 임시 사용자를 만들고 끝나면 지운다 (service role 키 사용).
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

type TestUser = { id: string; client: Db };

async function createTestUser(label: string): Promise<TestUser> {
  const email = `interest-test-${label}-${randomBytes(6).toString("hex")}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  assert.ok(created.data.user);
  const client: Db = createClient<Database>(url!, publishableKey!, clientOptions);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  return { id: created.data.user.id, client };
}

describe("제작 관심 표시 (두 부모 계정)", () => {
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

  it("A는 pdf와 book에 관심을 표시하고 읽는다", async () => {
    assert.ifError((await A.client.from("product_interests").insert({ user_id: A.id, product: "pdf" })).error);
    assert.ifError((await A.client.from("product_interests").insert({ user_id: A.id, product: "book" })).error);
    const read = await A.client.from("product_interests").select("product").eq("user_id", A.id);
    assert.ifError(read.error);
    assert.deepEqual(read.data?.map((row) => row.product).sort(), ["book", "pdf"]);
  });

  it("같은 상품을 두 번 표시하면 유니크 위반(23505)이다 (액션은 이를 성공으로 처리)", async () => {
    const again = await A.client.from("product_interests").insert({ user_id: A.id, product: "pdf" });
    assert.equal(again.error?.code, "23505");
  });

  it("목록에 없는 상품 키는 거부된다", async () => {
    const bad = await A.client.from("product_interests").insert({ user_id: A.id, product: "poster" });
    assert.ok(bad.error);
  });

  it("B는 A의 표시를 읽지도, 지우지도 못한다", async () => {
    const read = await B.client.from("product_interests").select("product");
    assert.ifError(read.error);
    assert.equal(read.data?.length, 0);
    const del = await B.client.from("product_interests").delete().eq("user_id", A.id).select("id");
    assert.ifError(del.error);
    assert.equal(del.data?.length, 0);
  });

  it("B는 A의 이름으로 표시를 만들 수 없다", async () => {
    const forged = await B.client.from("product_interests").insert({ user_id: A.id, product: "pdf" });
    assert.ok(forged.error);
  });

  it("A는 자기 표시를 취소(삭제)할 수 있다", async () => {
    const del = await A.client
      .from("product_interests")
      .delete()
      .eq("user_id", A.id)
      .eq("product", "pdf")
      .select("id");
    assert.ifError(del.error);
    assert.equal(del.data?.length, 1);
    const left = await A.client.from("product_interests").select("product").eq("user_id", A.id);
    assert.deepEqual(left.data?.map((row) => row.product), ["book"]);
  });

  it("수정(update)은 권한이 없다", async () => {
    const update = await A.client.from("product_interests").update({ product: "pdf" } as never).eq("user_id", A.id);
    assert.ok(update.error);
  });

  it("로그인하지 않은 클라이언트는 읽지 못한다", async () => {
    const anon: Db = createClient<Database>(url!, publishableKey!, clientOptions);
    const read = await anon.from("product_interests").select("product");
    assert.ok(read.error || read.data?.length === 0);
  });
});
