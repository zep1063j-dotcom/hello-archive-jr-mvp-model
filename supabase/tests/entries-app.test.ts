// 기록 앱 쿼리 검증 (SESSION 05). 실행: npm run test:entries
// src/lib/my-entries.ts · src/app/actions/entries.ts 가 쓰는 쿼리 모양 그대로를 서로 다른 두 부모 계정으로 실행한다.
// 개발용 프로젝트에만 실행한다. 임시 사용자를 만들고 끝나면 지운다 (service role 키 사용). 시드의 주간 질문 2개 이상이 필요하다.
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

type TestUser = { id: string; client: Db; childId: string };

async function createTestUser(label: string): Promise<TestUser> {
  const email = `entries-test-${label}-${randomBytes(6).toString("hex")}@example.com`;
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

// getMyEntries() 와 같은 쿼리
function readMyEntries(user: TestUser) {
  return user.client
    .from("entries")
    .select("id, body, created_at, updated_at, weekly_questions!inner(id, week_start, body, hint)")
    .eq("user_id", user.id)
    .eq("child_id", user.childId)
    .order("created_at", { ascending: false });
}

// saveThisWeekEntry() 의 insert / updateBody() 와 같은 쿼리
function insertEntry(user: TestUser, questionId: string, body: string) {
  return user.client
    .from("entries")
    .insert({ user_id: user.id, child_id: user.childId, weekly_question_id: questionId, body })
    .select("id");
}

function updateEntryBody(user: TestUser, entryId: string, body: string) {
  return user.client.from("entries").update({ body }).eq("id", entryId).eq("user_id", user.id).select("id");
}

describe("기록 앱 쿼리 (두 부모 계정)", () => {
  let userA: TestUser;
  let userB: TestUser;
  let questionIds: string[];
  let entryAId: string;

  before(async () => {
    const questions = await service.from("weekly_questions").select("id").order("week_start").limit(3);
    assert.ifError(questions.error);
    assert.ok(questions.data && questions.data.length >= 2, "weekly_questions 시드가 필요하다");
    questionIds = questions.data.map((q) => q.id);
    userA = await createTestUser("a");
    userB = await createTestUser("b");
  });

  after(async () => {
    if (userA) await service.auth.admin.deleteUser(userA.id);
    if (userB) await service.auth.admin.deleteUser(userB.id);
  });

  it("A는 이번 주 질문에 기록을 만들고 질문과 함께 다시 읽는다", async () => {
    const created = await insertEntry(userA, questionIds[0], "첫 기록");
    assert.ifError(created.error);
    entryAId = created.data![0].id;

    const { data, error } = await readMyEntries(userA);
    assert.ifError(error);
    assert.equal(data?.length, 1);
    assert.equal(data![0].body, "첫 기록");
    assert.equal(data![0].weekly_questions.id, questionIds[0]);
  });

  it("B는 A의 기록을 목록에서도, id로도 읽지 못한다", async () => {
    const list = await readMyEntries(userB);
    assert.ifError(list.error);
    assert.deepEqual(list.data, []);

    const byId = await userB.client.from("entries").select("id").eq("id", entryAId);
    assert.ifError(byId.error);
    assert.deepEqual(byId.data, []);
  });

  it("B가 A의 기록 id로 수정·삭제하면 0행이고 A의 기록은 그대로다 (액션이 이 경우를 실패로 처리)", async () => {
    const updated = await updateEntryBody(userB, entryAId, "해킹");
    assert.ifError(updated.error);
    assert.equal(updated.data?.length, 0);

    const deleted = await userB.client.from("entries").delete().eq("id", entryAId).eq("user_id", userB.id).select("id");
    assert.ifError(deleted.error);
    assert.equal(deleted.data?.length, 0);

    const a = await readMyEntries(userA);
    assert.equal(a.data?.[0].body, "첫 기록");
  });

  it("B는 user_id 를 A로 속이거나 A의 자녀에 기록을 만들 수 없다", async () => {
    const spoofUser = await userB.client
      .from("entries")
      .insert({ user_id: userA.id, child_id: userA.childId, weekly_question_id: questionIds[1], body: "가짜" });
    assert.ok(spoofUser.error);
    assert.equal(spoofUser.error.code, "42501");

    const spoofChild = await userB.client
      .from("entries")
      .insert({ user_id: userB.id, child_id: userA.childId, weekly_question_id: questionIds[1], body: "가짜" });
    assert.ok(spoofChild.error);
    assert.equal(spoofChild.error.code, "23503");
  });

  it("같은 질문에 다시 insert 하면 유니크 위반(23505)이다 (액션은 이를 수정으로 처리)", async () => {
    const again = await insertEntry(userA, questionIds[0], "중복");
    assert.ok(again.error);
    assert.equal(again.error.code, "23505");
  });

  it("A의 수정은 1행이 갱신되고 updated_at 만 바뀐다. 본문 외 컬럼은 바꿀 수 없다", async () => {
    const before = await service.from("entries").select("created_at, updated_at").eq("id", entryAId).single();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const updated = await updateEntryBody(userA, entryAId, "고친 기록");
    assert.ifError(updated.error);
    assert.equal(updated.data?.length, 1);

    const after = await service.from("entries").select("body, created_at, updated_at").eq("id", entryAId).single();
    assert.equal(after.data?.body, "고친 기록");
    assert.equal(after.data?.created_at, before.data?.created_at);
    assert.notEqual(after.data?.updated_at, before.data?.updated_at);

    // 질문·소유자 바꾸기는 컬럼 권한이 막는다
    const moved = await userA.client
      .from("entries")
      .update({ weekly_question_id: questionIds[1] } as never)
      .eq("id", entryAId);
    assert.ok(moved.error);
    assert.equal(moved.error.code, "42501");
  });

  it("공백만 있는 본문은 DB도 거부한다 (앱 검증을 우회하는 경우의 최종 방어선)", async () => {
    const blank = await insertEntry(userA, questionIds[1], "\n \t　");
    assert.ok(blank.error);
    assert.equal(blank.error.code, "23514");
  });

  it("같은 질문에 6개 동시 insert 가 겹쳐도 기록은 1개만 생긴다", async () => {
    const userC = await createTestUser("c");
    try {
      const results = await Promise.all(
        Array.from({ length: 6 }, (_, i) => insertEntry(userC, questionIds[0], `동시 ${i}`)),
      );
      assert.equal(results.filter((r) => !r.error).length, 1);
      assert.ok(results.filter((r) => r.error).every((r) => r.error?.code === "23505"));
      const rows = await service.from("entries").select("id").eq("user_id", userC.id);
      assert.equal(rows.data?.length, 1);
    } finally {
      await service.auth.admin.deleteUser(userC.id);
    }
  });

  it("A의 삭제는 1행이고, 지운 뒤 같은 질문에 다시 쓸 수 있다", async () => {
    const deleted = await userA.client.from("entries").delete().eq("id", entryAId).eq("user_id", userA.id).select("id");
    assert.ifError(deleted.error);
    assert.equal(deleted.data?.length, 1);

    const gone = await readMyEntries(userA);
    assert.deepEqual(gone.data, []);

    const rewritten = await insertEntry(userA, questionIds[0], "다시 쓴 기록");
    assert.ifError(rewritten.error);
  });
});
