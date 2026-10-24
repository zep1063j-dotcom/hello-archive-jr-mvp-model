// RLS · 권한 · 제약 교차 접근 테스트 (SESSION 02)
// 실행: npm run test:rls   (.env.local 에 개발용 Supabase 프로젝트 키가 있어야 한다)
//
// 개발용 프로젝트에만 실행한다. 테스트가 임시 사용자 2명과 임시 질문을 만들고,
// 끝나면 모두 지운다 (사용자를 지우면 하위 데이터는 cascade로 함께 지워진다).
// 이 테스트는 service role 키를 쓴다 — 키를 코드·채팅에 적지 않는다.
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
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY 가 필요하다 (.env.local).",
  );
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

// Postgres 오류 코드
const INSUFFICIENT_PRIVILEGE = "42501"; // RLS 위반 또는 권한 없음
const UNIQUE_VIOLATION = "23505";
const FK_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";

const service: Db = createClient<Database>(url, serviceKey, clientOptions);

type TestUser = { id: string; client: Db };

async function createTestUser(label: string): Promise<TestUser> {
  const email = `rls-test-${label}-${randomBytes(6).toString("hex")}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  assert.ok(created.data.user);

  const client: Db = createClient<Database>(url!, publishableKey!, clientOptions);
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  return { id: created.data.user.id, client };
}

// 먼 미래의 월요일 두 개 (실제 질문 시드와 겹치지 않는다)
function farFutureMondays(): [string, string] {
  const d = new Date(Date.UTC(2099, 0, 1));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  const first = d.toISOString().slice(0, 10);
  d.setUTCDate(d.getUTCDate() + 7);
  return [first, d.toISOString().slice(0, 10)];
}

describe("RLS · 권한 · 제약", () => {
  let userA: TestUser;
  let userB: TestUser;
  let anon: Db;
  let questionId: string;
  let questionId2: string;
  let childAId: string;
  let entryAId: string;
  const [monday1, monday2] = farFutureMondays();

  before(async () => {
    userA = await createTestUser("a");
    userB = await createTestUser("b");
    anon = createClient<Database>(url, publishableKey, clientOptions);

    const questions = await service
      .from("weekly_questions")
      .insert([
        { week_start: monday1, body: "[rls-test] 질문 1" },
        { week_start: monday2, body: "[rls-test] 질문 2" },
      ])
      .select();
    assert.ifError(questions.error);
    assert.ok(questions.data);
    questionId = questions.data.find((q) => q.week_start === monday1)!.id;
    questionId2 = questions.data.find((q) => q.week_start === monday2)!.id;

    const child = await userA.client
      .from("children")
      .insert({ user_id: userA.id, nickname: "에이", birth_date: "2022-05-14" })
      .select()
      .single();
    assert.ifError(child.error);
    childAId = child.data!.id;

    const entry = await userA.client
      .from("entries")
      .insert({ user_id: userA.id, child_id: childAId, weekly_question_id: questionId, body: "A의 기록" })
      .select()
      .single();
    assert.ifError(entry.error);
    entryAId = entry.data!.id;
  });

  after(async () => {
    // 사용자 삭제 → children / entries / parent_settings / email_deliveries cascade 삭제
    if (userA) await service.auth.admin.deleteUser(userA.id);
    if (userB) await service.auth.admin.deleteUser(userB.id);
    await service
      .from("weekly_questions")
      .delete()
      .in("week_start", [monday1, monday2]);
  });

  describe("사용자 간 격리 (교차 접근)", () => {
    it("B는 A의 자녀를 조회할 수 없다", async () => {
      const { data, error } = await userB.client.from("children").select().eq("id", childAId);
      assert.ifError(error);
      assert.deepEqual(data, []);
    });

    it("B는 A의 기록을 조회할 수 없다 (전체 조회에도 A의 행이 없다)", async () => {
      const byId = await userB.client.from("entries").select().eq("id", entryAId);
      assert.ifError(byId.error);
      assert.deepEqual(byId.data, []);

      const all = await userB.client.from("entries").select();
      assert.ifError(all.error);
      assert.deepEqual(all.data, []);
    });

    it("A는 자기 기록을 조회할 수 있다", async () => {
      const { data, error } = await userA.client.from("entries").select().eq("id", entryAId);
      assert.ifError(error);
      assert.equal(data?.length, 1);
      assert.equal(data?.[0]?.body, "A의 기록");
    });

    it("B는 A의 기록을 수정해도 0행만 영향받고 내용은 그대로다", async () => {
      const { data, error } = await userB.client
        .from("entries")
        .update({ body: "B가 덮어씀" })
        .eq("id", entryAId)
        .select();
      assert.ifError(error);
      assert.deepEqual(data, []);

      const check = await service.from("entries").select().eq("id", entryAId).single();
      assert.equal(check.data?.body, "A의 기록");
    });

    it("B는 A의 기록을 삭제해도 0행만 영향받고 기록은 남는다", async () => {
      const { data, error } = await userB.client.from("entries").delete().eq("id", entryAId).select();
      assert.ifError(error);
      assert.deepEqual(data, []);

      const check = await service.from("entries").select().eq("id", entryAId);
      assert.equal(check.data?.length, 1);
    });

    it("B는 A의 자녀를 수정·삭제할 수 없다", async () => {
      const upd = await userB.client
        .from("children")
        .update({ nickname: "해킹" })
        .eq("id", childAId)
        .select();
      assert.ifError(upd.error);
      assert.deepEqual(upd.data, []);

      const del = await userB.client.from("children").delete().eq("id", childAId).select();
      assert.ifError(del.error);
      assert.deepEqual(del.data, []);

      const check = await service.from("children").select().eq("id", childAId).single();
      assert.equal(check.data?.nickname, "에이");
    });

    it("B는 A의 이름(user_id)으로 자녀·기록을 만들 수 없다 (RLS)", async () => {
      const child = await userB.client
        .from("children")
        .insert({ user_id: userA.id, nickname: "가짜", birth_date: "2022-01-01" });
      assert.equal(child.error?.code, INSUFFICIENT_PRIVILEGE);

      const entry = await userB.client.from("entries").insert({
        user_id: userA.id,
        child_id: childAId,
        weekly_question_id: questionId2,
        body: "A인 척",
      });
      assert.equal(entry.error?.code, INSUFFICIENT_PRIVILEGE);
    });

    it("B는 자기 이름으로도 A의 자녀에 기록을 쓸 수 없다 (복합 FK)", async () => {
      const { error } = await userB.client.from("entries").insert({
        user_id: userB.id,
        child_id: childAId,
        weekly_question_id: questionId2,
        body: "남의 아이에게 쓰기",
      });
      assert.equal(error?.code, FK_VIOLATION);
    });

    it("parent_settings 도 사용자별로 격리된다", async () => {
      const mine = await userA.client
        .from("parent_settings")
        .insert({ user_id: userA.id, email_consent: false })
        .select()
        .single();
      assert.ifError(mine.error);

      const seen = await userB.client.from("parent_settings").select();
      assert.ifError(seen.error);
      assert.deepEqual(seen.data, []);

      const forged = await userB.client
        .from("parent_settings")
        .insert({ user_id: userA.id, email_consent: true });
      assert.equal(forged.error?.code, INSUFFICIENT_PRIVILEGE);

      const tamper = await userB.client
        .from("parent_settings")
        .update({ email_consent: true })
        .eq("user_id", userA.id)
        .select();
      assert.ifError(tamper.error);
      assert.deepEqual(tamper.data, []);
    });

    it("비로그인(anon)은 어떤 사용자 데이터도 읽을 수 없다", async () => {
      for (const table of ["children", "entries", "parent_settings", "weekly_questions"] as const) {
        const { data, error } = await anon.from(table).select();
        assert.equal(error?.code, INSUFFICIENT_PRIVILEGE, `${table}: anon select 는 거부되어야 한다`);
        assert.equal(data, null);
      }
      const insert = await anon
        .from("children")
        .insert({ user_id: userA.id, nickname: "익명", birth_date: "2022-01-01" });
      assert.equal(insert.error?.code, INSUFFICIENT_PRIVILEGE);
    });
  });

  describe("컬럼 단위 권한 (생성 후 바뀌면 안 되는 값)", () => {
    it("기록의 소유자·자녀·질문은 수정할 수 없다", async () => {
      for (const patch of [
        { user_id: userB.id },
        { child_id: childAId },
        { weekly_question_id: questionId2 },
        { created_at: "2000-01-01T00:00:00Z" },
      ]) {
        const { error } = await userA.client
          .from("entries")
          .update(patch as unknown as Database["public"]["Tables"]["entries"]["Update"])
          .eq("id", entryAId);
        assert.equal(error?.code, INSUFFICIENT_PRIVILEGE, JSON.stringify(patch));
      }
    });

    it("자녀의 소유자는 바꿀 수 없다", async () => {
      const { error } = await userA.client
        .from("children")
        .update({ user_id: userB.id } as unknown as Database["public"]["Tables"]["children"]["Update"])
        .eq("id", childAId);
      assert.equal(error?.code, INSUFFICIENT_PRIVILEGE);
    });

    it("본문 수정 시 updated_at 이 서버에서 갱신된다", async () => {
      const before = await userA.client.from("entries").select().eq("id", entryAId).single();
      const { data, error } = await userA.client
        .from("entries")
        .update({ body: "A의 기록(수정)" })
        .eq("id", entryAId)
        .select()
        .single();
      assert.ifError(error);
      assert.equal(data?.body, "A의 기록(수정)");
      assert.ok(Date.parse(data!.updated_at) > Date.parse(before.data!.updated_at));
      assert.equal(data?.created_at, before.data?.created_at);
    });

    it("이메일 수신 동의가 바뀔 때만 consent_updated_at 이 갱신된다", async () => {
      const first = await userA.client.from("parent_settings").select().eq("user_id", userA.id).single();
      assert.equal(first.data?.email_consent, false);

      const changed = await userA.client
        .from("parent_settings")
        .update({ email_consent: true })
        .eq("user_id", userA.id)
        .select()
        .single();
      assert.ifError(changed.error);
      assert.ok(Date.parse(changed.data!.consent_updated_at) > Date.parse(first.data!.consent_updated_at));

      const same = await userA.client
        .from("parent_settings")
        .update({ email_consent: true })
        .eq("user_id", userA.id)
        .select()
        .single();
      assert.equal(same.data?.consent_updated_at, changed.data?.consent_updated_at);
    });
  });

  describe("제약 조건", () => {
    it("같은 아이·같은 주 질문에는 기록을 하나만 만들 수 있다", async () => {
      const { error } = await userA.client.from("entries").insert({
        user_id: userA.id,
        child_id: childAId,
        weekly_question_id: questionId,
        body: "중복",
      });
      assert.equal(error?.code, UNIQUE_VIOLATION);
    });

    it("기록 본문은 공백만이거나 5000자를 넘을 수 없다 (5000자는 허용)", async () => {
      // 스페이스뿐 아니라 줄바꿈·탭·전각 공백·NBSP·zero-width space 만 있는 값도 거부
      for (const blankBody of ["   ", "   \n ", "\t\t", "　　", " ", "​"]) {
        const blank = await userA.client.from("entries").insert({
          user_id: userA.id,
          child_id: childAId,
          weekly_question_id: questionId2,
          body: blankBody,
        });
        assert.equal(blank.error?.code, CHECK_VIOLATION, JSON.stringify(blankBody));
      }

      const tooLong = await userA.client.from("entries").insert({
        user_id: userA.id,
        child_id: childAId,
        weekly_question_id: questionId2,
        body: "가".repeat(5001),
      });
      assert.equal(tooLong.error?.code, CHECK_VIOLATION);

      const edge = await userA.client
        .from("entries")
        .insert({
          user_id: userA.id,
          child_id: childAId,
          weekly_question_id: questionId2,
          body: "가".repeat(5000),
        })
        .select()
        .single();
      assert.ifError(edge.error);
    });

    it("자녀 별명은 1~30자, 생년월일은 미래일 수 없다", async () => {
      const blank = await userA.client
        .from("children")
        .insert({ user_id: userA.id, nickname: " \t\n", birth_date: "2022-01-01" });
      assert.equal(blank.error?.code, CHECK_VIOLATION);

      const long = await userA.client
        .from("children")
        .insert({ user_id: userA.id, nickname: "가".repeat(31), birth_date: "2022-01-01" });
      assert.equal(long.error?.code, CHECK_VIOLATION);

      const future = await userA.client
        .from("children")
        .insert({ user_id: userA.id, nickname: "미래", birth_date: "2999-01-01" });
      assert.equal(future.error?.code, CHECK_VIOLATION);
    });

    it("weekly_questions.week_start 는 월요일만 허용한다", async () => {
      const tuesday = new Date(`${monday1}T00:00:00Z`);
      tuesday.setUTCDate(tuesday.getUTCDate() + 1);
      const { error } = await service
        .from("weekly_questions")
        .insert({ week_start: tuesday.toISOString().slice(0, 10), body: "[rls-test] 화요일" });
      assert.equal(error?.code, CHECK_VIOLATION);
    });
  });

  describe("weekly_questions (읽기 전용)", () => {
    it("로그인한 사용자는 질문을 읽을 수 있다", async () => {
      const { data, error } = await userB.client.from("weekly_questions").select().eq("id", questionId);
      assert.ifError(error);
      assert.equal(data?.length, 1);
    });

    it("로그인한 사용자도 질문을 추가·수정·삭제할 수 없다", async () => {
      const insert = await userA.client
        .from("weekly_questions")
        .insert({ week_start: monday2, body: "해킹 질문" });
      assert.equal(insert.error?.code, INSUFFICIENT_PRIVILEGE);

      const update = await userA.client
        .from("weekly_questions")
        .update({ body: "해킹" })
        .eq("id", questionId);
      assert.equal(update.error?.code, INSUFFICIENT_PRIVILEGE);

      const del = await userA.client.from("weekly_questions").delete().eq("id", questionId);
      assert.equal(del.error?.code, INSUFFICIENT_PRIVILEGE);

      const check = await service.from("weekly_questions").select().eq("id", questionId).single();
      assert.equal(check.data?.body, "[rls-test] 질문 1");
    });
  });

  describe("email_deliveries (서버 전용)", () => {
    it("일반 사용자·비로그인은 읽기·쓰기 모두 거부된다", async () => {
      const seeded = await service
        .from("email_deliveries")
        .insert({ user_id: userA.id, weekly_question_id: questionId });
      assert.ifError(seeded.error);

      for (const client of [userA.client, userB.client, anon]) {
        const read = await client.from("email_deliveries").select();
        assert.equal(read.error?.code, INSUFFICIENT_PRIVILEGE);

        const write = await client
          .from("email_deliveries")
          .insert({ user_id: userA.id, weekly_question_id: questionId2 });
        assert.equal(write.error?.code, INSUFFICIENT_PRIVILEGE);
      }
    });

    it("같은 부모·같은 질문의 중복 발송 기록은 만들 수 없다 (service role)", async () => {
      const { error } = await service
        .from("email_deliveries")
        .insert({ user_id: userA.id, weekly_question_id: questionId });
      assert.equal(error?.code, UNIQUE_VIOLATION);
    });

    it("status 는 정해진 값만 허용한다", async () => {
      const { error } = await service.from("email_deliveries").insert({
        user_id: userB.id,
        weekly_question_id: questionId,
        status: "done" as never,
      });
      assert.equal(error?.code, CHECK_VIOLATION);
    });
  });

  describe("삭제 전파", () => {
    it("자녀를 지우면 그 아이의 기록도 함께 지워진다 (본인 계정)", async () => {
      const child = await userB.client
        .from("children")
        .insert({ user_id: userB.id, nickname: "비", birth_date: "2023-03-01" })
        .select()
        .single();
      assert.ifError(child.error);
      const entry = await userB.client
        .from("entries")
        .insert({
          user_id: userB.id,
          child_id: child.data!.id,
          weekly_question_id: questionId,
          body: "B의 기록",
        })
        .select()
        .single();
      assert.ifError(entry.error);

      const del = await userB.client.from("children").delete().eq("id", child.data!.id);
      assert.ifError(del.error);

      const left = await service.from("entries").select().eq("id", entry.data!.id);
      assert.deepEqual(left.data, []);
    });

    it("계정을 지우면 자녀·기록·설정·발송 내역이 모두 지워진다", async () => {
      const temp = await createTestUser("cascade");
      const child = await temp.client
        .from("children")
        .insert({ user_id: temp.id, nickname: "임시", birth_date: "2023-03-01" })
        .select()
        .single();
      assert.ifError(child.error);
      assert.ifError(
        (
          await temp.client.from("entries").insert({
            user_id: temp.id,
            child_id: child.data!.id,
            weekly_question_id: questionId,
            body: "곧 사라질 기록",
          })
        ).error,
      );
      assert.ifError((await temp.client.from("parent_settings").insert({ user_id: temp.id })).error);
      assert.ifError(
        (await service.from("email_deliveries").insert({ user_id: temp.id, weekly_question_id: questionId }))
          .error,
      );

      const removed = await service.auth.admin.deleteUser(temp.id);
      assert.ifError(removed.error);

      for (const table of ["children", "entries", "parent_settings", "email_deliveries"] as const) {
        const rows = await service.from(table).select().eq("user_id", temp.id);
        assert.ifError(rows.error);
        assert.deepEqual(rows.data, [], `${table} 에 남은 행이 있다`);
      }
    });
  });
});
