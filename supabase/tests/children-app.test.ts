// 자녀 프로필 앱 쿼리 검증 (SESSION 04). 실행: npm run test:children
// src/lib/children.ts · src/app/actions/children.ts 가 쓰는 쿼리 모양 그대로를 서로 다른 두 부모 계정으로 실행한다.
// 개발용 프로젝트에만 실행한다. 임시 사용자 2명을 만들고 끝나면 지운다 (service role 키 사용).
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
  const email = `children-test-${label}-${randomBytes(6).toString("hex")}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  assert.ok(created.data.user);
  const client: Db = createClient<Database>(url!, publishableKey!, clientOptions);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  return { id: created.data.user.id, client };
}

// getMyChild() 와 같은 쿼리
function readMyChild(user: TestUser) {
  return user.client
    .from("children")
    .select("id, nickname, birth_date")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
}

// updateChild() 와 같은 갱신 쿼리 (갱신된 행을 돌려받아 0행 여부를 확인한다)
function updateChildRow(user: TestUser, childId: string, nickname: string) {
  return user.client
    .from("children")
    .update({ nickname, birth_date: "2021-01-01" })
    .eq("id", childId)
    .eq("user_id", user.id)
    .select("id");
}

describe("자녀 프로필 앱 쿼리 (두 부모 계정)", () => {
  let userA: TestUser;
  let userB: TestUser;
  let childAId: string;

  before(async () => {
    userA = await createTestUser("a");
    userB = await createTestUser("b");
    const created = await userA.client
      .from("children")
      .insert({ user_id: userA.id, nickname: "에이", birth_date: "2022-05-14" })
      .select("id")
      .single();
    assert.ifError(created.error);
    childAId = created.data!.id;
  });

  after(async () => {
    if (userA) await service.auth.admin.deleteUser(userA.id);
    if (userB) await service.auth.admin.deleteUser(userB.id);
  });

  it("A는 자기 자녀를 읽고, B는 자녀가 없다고 나온다 (온보딩 대상)", async () => {
    const a = await readMyChild(userA);
    assert.ifError(a.error);
    assert.equal(a.data?.id, childAId);

    const b = await readMyChild(userB);
    assert.ifError(b.error);
    assert.equal(b.data, null);
  });

  it("B가 id를 알아도 user_id 조건을 빼고 조회하면 RLS가 막는다", async () => {
    const { data, error } = await userB.client.from("children").select("id").eq("id", childAId);
    assert.ifError(error);
    assert.deepEqual(data, []);
  });

  it("자녀 수 확인(count)은 자기 자녀만 센다", async () => {
    const countFor = async (user: TestUser) => {
      const { count, error } = await user.client
        .from("children")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      assert.ifError(error);
      return count;
    };
    assert.equal(await countFor(userA), 1);
    assert.equal(await countFor(userB), 0);
  });

  it("B가 A의 자녀 id로 수정하면 0행이 갱신되고 A의 값은 그대로다 (액션이 이 경우를 실패로 처리)", async () => {
    const { data, error } = await updateChildRow(userB, childAId, "해킹");
    assert.ifError(error);
    assert.equal(data?.length, 0);

    const a = await readMyChild(userA);
    assert.equal(a.data?.nickname, "에이");
  });

  it("A의 수정은 1행이 갱신되고 updated_at 이 바뀐다", async () => {
    const before = await service.from("children").select("updated_at").eq("id", childAId).single();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const { data, error } = await updateChildRow(userA, childAId, "에이2");
    assert.ifError(error);
    assert.equal(data?.length, 1);
    const after = await service.from("children").select("nickname, updated_at").eq("id", childAId).single();
    assert.equal(after.data?.nickname, "에이2");
    assert.notEqual(after.data?.updated_at, before.data?.updated_at);
  });

  it("같은 부모의 동시 등록 요청이 겹쳐도 자녀는 1명만 생긴다 (마이그레이션 20261024000200 필요)", async () => {
    const userC = await createTestUser("c");
    try {
      // createChild 액션과 같은 순서: 개수 확인 → 없으면 insert
      const attempt = async () => {
        const { count } = await userC.client
          .from("children")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userC.id);
        if (!count) {
          await userC.client
            .from("children")
            .insert({ user_id: userC.id, nickname: "경합", birth_date: "2022-05-14" });
        }
      };
      await Promise.all(Array.from({ length: 6 }, attempt));
      const rows = await service.from("children").select("id").eq("user_id", userC.id);
      assert.ifError(rows.error);
      assert.equal(rows.data?.length, 1);
    } finally {
      await service.auth.admin.deleteUser(userC.id);
    }
  });

  it("B는 user_id 를 A로 속여 자녀를 만들 수 없다", async () => {
    const { error } = await userB.client
      .from("children")
      .insert({ user_id: userA.id, nickname: "가짜", birth_date: "2022-05-14" });
    assert.ok(error);
    assert.equal(error.code, "42501");
  });
});
