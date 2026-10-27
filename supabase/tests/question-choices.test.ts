// 질문 은행·이번 주 질문 바꾸기 검증 (D-025). 실행: npm run test:choices
// src/app/actions/question-choices.ts 가 쓰는 쿼리 모양을 서로 다른 두 부모 계정으로 실행한다.
// 필요: 마이그레이션 20261026000000·20261027000000 과 supabase/seed/question_bank.sql 이 적용된 개발용 프로젝트.
// 임시 사용자·임시 질문(2020년 월요일)을 만들고 끝나면 지운다 (service role 키 사용).
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
  const email = `choices-test-${label}-${randomBytes(6).toString("hex")}@example.com`;
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

describe("질문 은행·이번 주 질문 바꾸기 (두 부모 계정)", () => {
  let A: TestUser;
  let B: TestUser;
  const weekIds: string[] = [];
  let bankId: string;
  let bankBody: string;

  before(async () => {
    for (const week of ["2020-04-06", "2020-04-13"]) {
      const q = await service
        .from("weekly_questions")
        .insert({ week_start: week, body: `[choices-test] ${week}` })
        .select("id")
        .single();
      assert.ifError(q.error);
      weekIds.push(q.data!.id);
    }
    A = await createTestUser("a");
    B = await createTestUser("b");
    const bank = await A.client.from("question_bank").select("id, body").limit(1).single();
    assert.ifError(bank.error);
    bankId = bank.data!.id;
    bankBody = bank.data!.body;
  });

  after(async () => {
    if (A) await service.auth.admin.deleteUser(A.id);
    if (B) await service.auth.admin.deleteUser(B.id);
    await service.from("weekly_questions").delete().in("id", weekIds);
  });

  it("질문 은행은 로그인한 부모가 100개 이상 읽을 수 있고 쓸 수는 없다", async () => {
    const count = await A.client.from("question_bank").select("id", { count: "exact", head: true });
    assert.ifError(count.error);
    assert.ok((count.count ?? 0) >= 100, `은행 질문 ${count.count}개 — question_bank.sql 시드가 필요하다`);
    const insert = await A.client.from("question_bank").insert({ body: "내가 만든 은행 질문" });
    assert.ok(insert.error, "은행 쓰기는 막혀야 한다");
  });

  it("A는 은행 질문과 직접 쓴 질문을 주마다 하나씩 저장하고 다시 읽는다", async () => {
    const bank = await A.client
      .from("week_question_choices")
      .insert({ user_id: A.id, weekly_question_id: weekIds[0], source: "bank", bank_question_id: bankId, body: bankBody })
      .select("id");
    assert.ifError(bank.error);
    const custom = await A.client
      .from("week_question_choices")
      .insert({ user_id: A.id, weekly_question_id: weekIds[1], source: "custom", body: "우리 아이가 오늘 웃은 이유는?" })
      .select("id");
    assert.ifError(custom.error);

    const read = await A.client.from("week_question_choices").select("weekly_question_id, source, body").eq("user_id", A.id);
    assert.ifError(read.error);
    assert.equal(read.data?.length, 2);
  });

  it("같은 주에 두 번째 선택은 유니크 위반(23505)이다 (액션은 이를 수정으로 처리)", async () => {
    const again = await A.client
      .from("week_question_choices")
      .insert({ user_id: A.id, weekly_question_id: weekIds[0], source: "custom", body: "중복" });
    assert.equal(again.error?.code, "23505");
  });

  it("B는 A의 선택을 읽지 못하고, A의 id로 만들거나 고치지도 못한다", async () => {
    const list = await B.client.from("week_question_choices").select("id");
    assert.ifError(list.error);
    assert.deepEqual(list.data, []);

    const spoof = await B.client
      .from("week_question_choices")
      .insert({ user_id: A.id, weekly_question_id: weekIds[0], source: "custom", body: "속임" });
    assert.ok(spoof.error, "남의 user_id 로 만들 수 없어야 한다");

    const edit = await B.client.from("week_question_choices").update({ body: "남이 바꿈" }).eq("user_id", A.id).select("id");
    assert.ifError(edit.error);
    assert.equal(edit.data?.length, 0);
  });

  it("공백·길이·출처 규칙은 DB도 거부한다", async () => {
    const weekless = weekIds[0];
    const blank = await B.client
      .from("week_question_choices")
      .insert({ user_id: B.id, weekly_question_id: weekless, source: "custom", body: "   " });
    assert.ok(blank.error, "공백만 불가");
    const long = await B.client
      .from("week_question_choices")
      .insert({ user_id: B.id, weekly_question_id: weekless, source: "custom", body: "가".repeat(201) });
    assert.ok(long.error, "201자 불가");
    const bankNoRef = await B.client
      .from("week_question_choices")
      .insert({ user_id: B.id, weekly_question_id: weekless, source: "bank", body: "은행인데 id 없음" });
    assert.ok(bankNoRef.error, "bank 는 bank_question_id 필수");
    const customWithRef = await B.client
      .from("week_question_choices")
      .insert({ user_id: B.id, weekly_question_id: weekless, source: "custom", bank_question_id: bankId, body: "직접인데 id 있음" });
    assert.ok(customWithRef.error, "custom 은 bank_question_id 불가");
  });

  it("기록을 남긴 뒤에도 그 주 질문을 바꾸고 되돌릴 수 있다 (D-034). 남의 선택은 여전히 못 건드린다", async () => {
    const entry = await A.client
      .from("entries")
      .insert({ user_id: A.id, child_id: A.childId, weekly_question_id: weekIds[1], body: "기록" })
      .select("id");
    assert.ifError(entry.error);

    const update = await A.client.from("week_question_choices").update({ body: "기록 뒤 변경" }).eq("user_id", A.id).eq("weekly_question_id", weekIds[1]).select("id, body");
    assert.ifError(update.error);
    assert.equal(update.data?.length, 1, "기록 있는 주도 수정 1행");
    assert.equal(update.data?.[0].body, "기록 뒤 변경");

    // 선택이 없던 주에도 기록 뒤에 새로 만들 수 있다
    const del = await A.client.from("week_question_choices").delete().eq("user_id", A.id).eq("weekly_question_id", weekIds[1]).select("id");
    assert.ifError(del.error);
    assert.equal(del.data?.length, 1, "기록 있는 주도 삭제(기본 질문으로 되돌리기) 1행");
    const insert = await A.client
      .from("week_question_choices")
      .insert({ user_id: A.id, weekly_question_id: weekIds[1], source: "custom", body: "기록 뒤 새 질문" })
      .select("id");
    assert.ifError(insert.error);
    assert.equal(insert.data?.length, 1);

    // 기록은 그대로 그 주 질문에 매달려 있다
    const kept = await A.client.from("entries").select("weekly_question_id").eq("id", entry.data![0].id).single();
    assert.ifError(kept.error);
    assert.equal(kept.data?.weekly_question_id, weekIds[1]);

    // 소유 조건은 유지: B는 A의 선택을 고치거나 지우지 못한다
    const byB = await B.client.from("week_question_choices").update({ body: "남이 고침" }).eq("user_id", A.id).eq("weekly_question_id", weekIds[1]).select("id");
    assert.ifError(byB.error);
    assert.equal(byB.data?.length, 0);
    const delByB = await B.client.from("week_question_choices").delete().eq("user_id", A.id).eq("weekly_question_id", weekIds[1]).select("id");
    assert.ifError(delByB.error);
    assert.equal(delByB.data?.length, 0);

    const removed = await A.client.from("entries").delete().eq("id", entry.data![0].id).select("id");
    assert.ifError(removed.error);
  });

  it("주·소유자는 수정할 수 없다 (컬럼 GRANT)", async () => {
    const result = await A.client
      .from("week_question_choices")
      .update({ weekly_question_id: weekIds[1] } as never)
      .eq("user_id", A.id)
      .eq("weekly_question_id", weekIds[0]);
    assert.ok(result.error, "weekly_question_id 수정은 GRANT가 막아야 한다");
  });

  it("부모 계정을 지우면 선택도 함께 지워진다", async () => {
    await service.auth.admin.deleteUser(B.id);
    const left = await service.from("week_question_choices").select("id").eq("user_id", B.id);
    assert.ifError(left.error);
    assert.deepEqual(left.data, []);
  });
});
