// 기록 앱 쿼리 검증 (SESSION 05). 실행: npm run test:entries
// src/lib/my-entries.ts · src/app/actions/entries.ts 가 쓰는 쿼리 모양 그대로를 서로 다른 두 부모 계정으로 실행한다.
// 개발용 프로젝트에만 실행한다. 임시 사용자를 만들고 끝나면 지운다 (service role 키 사용). 시드의 주간 질문 2개 이상이 필요하다.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { toLikePattern } from "../../src/lib/entry-search.ts";
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

// 기록 검색(getMyEntries의 search)과 지난 질문 쿼리(getMissedQuestions)가 쓰는 쿼리 모양 (D-024)
describe("기록 검색·지난 질문 쿼리 (두 부모 계정)", () => {
  let userA: TestUser;
  let userB: TestUser;
  const pastWeeks = ["2020-03-02", "2020-03-09", "2020-03-16"]; // 시드와 겹치지 않는 월요일
  const pastIds: string[] = [];

  const search = (user: TestUser, term: string) =>
    user.client
      .from("entries")
      .select("id, body")
      .eq("user_id", user.id)
      .eq("child_id", user.childId)
      .ilike("body", toLikePattern(term))
      .order("created_at", { ascending: false });

  before(async () => {
    for (const week of pastWeeks) {
      const q = await service
        .from("weekly_questions")
        .insert({ week_start: week, body: `[entries-test] ${week}` })
        .select("id")
        .single();
      assert.ifError(q.error);
      pastIds.push(q.data!.id);
    }
    userA = await createTestUser("search-a");
    userB = await createTestUser("search-b");
  });

  after(async () => {
    if (userA) await service.auth.admin.deleteUser(userA.id);
    if (userB) await service.auth.admin.deleteUser(userB.id);
    await service.from("weekly_questions").delete().in("id", pastIds);
  });

  it("지난 질문(시드에 없는 과거 주)에도 기록을 만들 수 있고 주 단위로 한 번만 쓸 수 있다", async () => {
    const first = await insertEntry(userA, pastIds[0], "공룡 이야기를 100% 좋아해요");
    assert.ifError(first.error);
    const second = await insertEntry(userA, pastIds[1], "블록 쌓기");
    assert.ifError(second.error);
    const again = await insertEntry(userA, pastIds[0], "중복");
    assert.equal(again.error?.code, "23505"); // 액션은 이를 수정으로 처리한다
  });

  it("놓친 질문 목록 쿼리: 범위(gte/lt) 안에서 답한 질문을 뺀다", async () => {
    // getMissedQuestions: week_start >= 등록 주, < 이번 주
    const { data, error } = await userA.client
      .from("weekly_questions")
      .select("id, week_start")
      .gte("week_start", "2020-03-02")
      .lt("week_start", "2020-03-23")
      .order("week_start", { ascending: false });
    assert.ifError(error);
    assert.deepEqual(data!.map((q) => q.week_start), ["2020-03-16", "2020-03-09", "2020-03-02"]);

    const answered = new Set((await readMyEntries(userA)).data!.map((e) => e.weekly_questions.id));
    const missed = data!.filter((q) => !answered.has(q.id));
    assert.deepEqual(missed.map((q) => q.week_start), ["2020-03-16"]);
  });

  it("검색은 본문 부분 일치(대소문자 무시)이고 %·_는 글자 그대로 찾는다", async () => {
    assert.equal((await search(userA, "공룡")).data?.length, 1);
    assert.equal((await search(userA, "블록")).data?.length, 1);
    assert.equal((await search(userA, "100%")).data?.length, 1);
    assert.equal((await search(userA, "없는말")).data?.length, 0);
    // 와일드카드 주입: "%"만, "_" 하나만으로는 전부 매칭되지 않는다
    assert.equal((await search(userA, "%")).data?.length, 1); // 본문에 실제 % 가 있는 기록만
    assert.equal((await search(userA, "_")).data?.length, 0);
  });

  it("검색은 남의 기록을 찾지 못한다", async () => {
    const result = await search(userB, "공룡");
    assert.ifError(result.error);
    assert.deepEqual(result.data, []);
  });
});

// 같은 주에 시기별 질문 행이 여러 개일 때 기록 찾기·저장 (D-038, D-039).
// src/lib/week-entry.ts 의 findWeekEntry() 와 같은 쿼리 모양이다(그 파일은 server-only라 테스트에서 직접 부를 수 없다).
describe("시기별 질문 행과 한 주의 기록 (D-039)", () => {
  let user: TestUser;
  let other: TestUser;
  let early: { id: string; week_start: string };
  let child: { id: string; week_start: string };

  const findWeekEntry = (who: TestUser, weekStart: string) =>
    who.client
      .from("entries")
      .select("id, weekly_questions!inner(id, body, week_start)")
      .eq("user_id", who.id)
      .eq("child_id", who.childId)
      .eq("weekly_questions.week_start", weekStart)
      .order("created_at", { ascending: true })
      .limit(1);

  before(async () => {
    // 유년·아동 질문이 모두 있는 주 하나를 고른다
    const rows = await service.from("weekly_questions").select("id, week_start, stage").in("stage", ["early", "child"]).order("week_start").limit(40);
    assert.ifError(rows.error);
    const byWeek = new Map<string, { early?: { id: string; week_start: string }; child?: { id: string; week_start: string } }>();
    for (const row of rows.data!) {
      const slot = byWeek.get(row.week_start) ?? {};
      if (row.stage === "early") slot.early = row;
      if (row.stage === "child") slot.child = row;
      byWeek.set(row.week_start, slot);
    }
    const week = [...byWeek.values()].find((slot) => slot.early && slot.child);
    assert.ok(week?.early && week.child, "같은 주에 early·child 질문이 모두 있는 시드가 필요하다 (supabase/apply/5_question_stages.sql)");
    early = week.early;
    child = week.child;
    user = await createTestUser("week-a");
    other = await createTestUser("week-b");
  });

  after(async () => {
    if (user) await service.auth.admin.deleteUser(user.id);
    if (other) await service.auth.admin.deleteUser(other.id);
  });

  it("다른 시기의 질문 행에 매달린 기록도 같은 주면 찾는다", async () => {
    const saved = await insertEntry(user, early.id, "예전 시기 질문에 쓴 기록");
    assert.ifError(saved.error);
    const found = await findWeekEntry(user, child.week_start);
    assert.ifError(found.error);
    assert.equal(found.data?.length, 1);
    assert.equal(found.data![0].weekly_questions.id, early.id); // 기록은 자기 질문 행에 그대로 매달려 있다
  });

  it("다른 부모는 그 주 기록을 찾지 못한다", async () => {
    const found = await findWeekEntry(other, child.week_start);
    assert.ifError(found.error);
    assert.deepEqual(found.data, []);
  });

  it("앱은 같은 주의 기존 기록을 찾아 본문만 고친다 — 지금 시기의 질문 행에 새 기록을 만들지 않는다", async () => {
    // 액션(saveEntryForQuestion)과 같은 순서: 주로 기존 기록 찾기 → 있으면 본문 수정
    const existing = (await findWeekEntry(user, child.week_start)).data![0];
    const updated = await updateEntryBody(user, existing.id, "수정한 본문");
    assert.ifError(updated.error);
    assert.equal(updated.data?.length, 1);

    const all = await readMyEntries(user);
    assert.equal(all.data?.length, 1, "한 주에 기록은 하나");
    assert.equal(all.data![0].body, "수정한 본문");
    assert.equal(all.data![0].weekly_questions.id, early.id);
  });
});
