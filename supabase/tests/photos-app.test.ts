// 사진(프로필·기록) 검증 (D-027). 실행: npm run test:photos
// src/app/actions/photos.ts 가 쓰는 Storage·DB 호출을 서로 다른 두 부모 계정으로 실행한다.
// 필요: 마이그레이션 20261026000200(버킷 `photos` 포함)이 적용된 개발용 프로젝트. 임시 사용자·파일을 만들고 끝나면 지운다.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
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
const BUCKET = "photos";

// 1x1 JPEG (유효한 최소 파일)
const JPEG = Uint8Array.from(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64",
  ),
);

type TestUser = { id: string; client: Db; childId: string; entryId: string };

describe("사진: Storage·DB (두 부모 계정)", () => {
  let A: TestUser;
  let B: TestUser;
  let questionId: string;
  const uploaded: string[] = [];

  async function createTestUser(label: string): Promise<TestUser> {
    const email = `photos-test-${label}-${randomBytes(6).toString("hex")}@example.com`;
    const password = randomBytes(24).toString("base64url");
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ifError(created.error);
    const id = created.data.user!.id;
    const client: Db = createClient<Database>(url!, publishableKey!, clientOptions);
    assert.ifError((await client.auth.signInWithPassword({ email, password })).error);
    const child = await client.from("children").insert({ user_id: id, nickname: label, birth_date: "2022-05-14" }).select("id").single();
    assert.ifError(child.error);
    const entry = await client
      .from("entries")
      .insert({ user_id: id, child_id: child.data!.id, weekly_question_id: questionId, body: "사진 테스트" })
      .select("id")
      .single();
    assert.ifError(entry.error);
    return { id, client, childId: child.data!.id, entryId: entry.data!.id };
  }

  const upload = (user: TestUser, folder: string, name = `${randomUUID()}.jpg`) => {
    const path = `${folder}/${name}`;
    return user.client.storage.from(BUCKET).upload(path, JPEG, { contentType: "image/jpeg", upsert: false }).then((result) => {
      if (!result.error) uploaded.push(path);
      return { path, ...result };
    });
  };

  before(async () => {
    const q = await service.from("weekly_questions").insert({ week_start: "2020-05-04", body: "[photos-test]" }).select("id").single();
    assert.ifError(q.error);
    questionId = q.data!.id;
    A = await createTestUser("a");
    B = await createTestUser("b");
  });

  after(async () => {
    if (uploaded.length > 0) await service.storage.from(BUCKET).remove(uploaded);
    if (A) await service.auth.admin.deleteUser(A.id);
    if (B) await service.auth.admin.deleteUser(B.id);
    await service.from("weekly_questions").delete().eq("id", questionId);
  });

  it("버킷은 비공개이고 5MB·이미지 3종으로 제한돼 있다", async () => {
    const bucket = await service.storage.getBucket(BUCKET);
    assert.ifError(bucket.error);
    assert.equal(bucket.data?.public, false);
    assert.equal(bucket.data?.file_size_limit, 5242880);
    assert.deepEqual([...(bucket.data?.allowed_mime_types ?? [])].sort(), ["image/jpeg", "image/png", "image/webp"]);
  });

  it("A는 자기 폴더에만 올릴 수 있고, 남의 폴더·다른 형식은 거부된다", async () => {
    const own = await upload(A, A.id);
    assert.ifError(own.error);
    const intoB = await upload(A, B.id);
    assert.ok(intoB.error, "남의 폴더에는 올릴 수 없어야 한다");
    const gif = await A.client.storage.from(BUCKET).upload(`${A.id}/${randomUUID()}.gif`, JPEG, { contentType: "image/gif" });
    assert.ok(gif.error, "허용되지 않은 형식은 거부돼야 한다");
  });

  it("B는 A의 사진을 서명 URL로도 읽지 못하고 지우지도 못한다. A는 읽는다", async () => {
    const own = await upload(A, A.id);
    assert.ifError(own.error);
    const mine = await A.client.storage.from(BUCKET).createSignedUrl(own.path, 60);
    assert.ifError(mine.error);
    assert.ok(mine.data?.signedUrl);
    const theirs = await B.client.storage.from(BUCKET).createSignedUrl(own.path, 60);
    assert.ok(theirs.error || !theirs.data?.signedUrl, "남의 파일은 서명할 수 없어야 한다");
    const removed = await B.client.storage.from(BUCKET).remove([own.path]);
    // 지워지지 않아야 한다 (오류이거나 0개 삭제)
    assert.ok(removed.error || (removed.data ?? []).length === 0);
    const still = await A.client.storage.from(BUCKET).createSignedUrl(own.path, 60);
    assert.ok(still.data?.signedUrl, "A의 파일은 그대로여야 한다");
  });

  it("기록 사진 행: 내 폴더 경로만, 한 기록에 3장까지, 남의 기록에는 못 붙인다", async () => {
    const paths: string[] = [];
    for (let i = 0; i < 3; i++) {
      const path = `${A.id}/${randomUUID()}.jpg`;
      paths.push(path);
      const row = await A.client.from("entry_photos").insert({ user_id: A.id, entry_id: A.entryId, path }).select("id");
      assert.ifError(row.error);
    }
    const fourth = await A.client.from("entry_photos").insert({ user_id: A.id, entry_id: A.entryId, path: `${A.id}/${randomUUID()}.jpg` });
    assert.ok(fourth.error, "4번째 사진은 DB가 거부해야 한다");
    const foreignPath = await B.client.from("entry_photos").insert({ user_id: B.id, entry_id: B.entryId, path: `${A.id}/${randomUUID()}.jpg` });
    assert.ok(foreignPath.error, "남의 폴더 경로는 거부돼야 한다");
    const onOthers = await B.client.from("entry_photos").insert({ user_id: B.id, entry_id: A.entryId, path: `${B.id}/${randomUUID()}.jpg` });
    assert.ok(onOthers.error, "남의 기록에는 붙일 수 없어야 한다");

    const seenByB = await B.client.from("entry_photos").select("id");
    assert.ifError(seenByB.error);
    assert.deepEqual(seenByB.data, []);
    const delByB = await B.client.from("entry_photos").delete().eq("entry_id", A.entryId).select("id");
    assert.ifError(delByB.error);
    assert.equal(delByB.data?.length, 0);
  });

  it("프로필 사진 경로는 내 폴더 안이어야 하고 남의 자녀 것은 바꿀 수 없다", async () => {
    const own = await A.client.from("children").update({ photo_path: `${A.id}/avatar.jpg` }).eq("id", A.childId).eq("user_id", A.id).select("id");
    assert.ifError(own.error);
    assert.equal(own.data?.length, 1);
    const foreign = await A.client.from("children").update({ photo_path: `${B.id}/avatar.jpg` }).eq("id", A.childId).select("id");
    assert.ok(foreign.error, "남의 폴더 경로는 거부돼야 한다");
    const onOther = await B.client.from("children").update({ photo_path: `${B.id}/x.jpg` }).eq("id", A.childId).select("id");
    assert.ifError(onOther.error);
    assert.equal(onOther.data?.length, 0);
  });

  it("기록을 지우면 사진 행도 함께 지워진다 (파일은 앱이 지운다)", async () => {
    const del = await A.client.from("entries").delete().eq("id", A.entryId).select("id");
    assert.ifError(del.error);
    const left = await service.from("entry_photos").select("id").eq("entry_id", A.entryId);
    assert.ifError(left.error);
    assert.deepEqual(left.data, []);
  });
});
