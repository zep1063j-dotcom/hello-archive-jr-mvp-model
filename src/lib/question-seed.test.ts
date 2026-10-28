import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

// 질문 시드 점검 (D-047): 앞으로 나갈 질문은 한 질문에 한 가지만 묻는다.
// 이미 지난 주(2026-11-02 이전)의 질문은 기록이 달려 있을 수 있어 그대로 두므로 검사하지 않는다.
const FROM = "2026-11-02";

function read(path: string): string {
  return readFileSync(new URL(`../../supabase/seed/${path}`, import.meta.url), "utf8");
}

// ('2026-11-02', 'early', '문구', null) 한 줄씩
function weeklyRows(): { week: string; stage: string; body: string }[] {
  const rows = [...read("weekly_questions.sql").matchAll(/\('(\d{4}-\d\d-\d\d)', '(\w+)', '((?:[^']|'')*)', /g)];
  return rows.map((m) => ({ week: m[1], stage: m[2], body: m[3].replaceAll("''", "'") }));
}

function bankRows(): { stage: string; body: string }[] {
  // 끝의 "숨기기" 문장 앞까지가 켜 두는 질문이다
  const active = read("question_bank.sql").split("update public.question_bank")[0];
  return [...active.matchAll(/^ {2}\('(\w+)', '((?:[^']|'')*)'\)/gm)].map((m) => ({
    stage: m[1],
    body: m[2].replaceAll("''", "'"),
  }));
}

const askedCount = (body: string) => body.split("?").length - 1;

describe("질문 시드", () => {
  it("앞으로 나갈 주간 질문은 한 질문에 한 가지만 묻는다", () => {
    const upcoming = weeklyRows().filter((row) => row.week >= FROM);
    assert.ok(upcoming.length > 90);
    for (const row of upcoming) assert.ok(askedCount(row.body) <= 1, `${row.week} ${row.stage}: ${row.body}`);
  });

  it("질문 은행의 켜 둔 질문도 한 가지만 묻고, 같은 문구가 겹치지 않는다", () => {
    const bank = bankRows();
    assert.ok(bank.length > 150);
    for (const row of bank) assert.ok(askedCount(row.body) <= 1, row.body);
    assert.equal(new Set(bank.map((row) => row.body)).size, bank.length);
  });

  it("같은 시기에서 한 문구가 두 주에 나오지 않는다", () => {
    for (const stage of ["early", "child", "teen", "young"]) {
      const bodies = weeklyRows().filter((row) => row.stage === stage).map((row) => row.body);
      assert.equal(new Set(bodies).size, bodies.length, stage);
    }
  });

  it("앞으로 나갈 주간 질문은 모두 질문 은행에도 있다 (질문 바꾸기에서 같은 질문이 보인다)", () => {
    const bank = new Set(bankRows().map((row) => row.body));
    for (const row of weeklyRows().filter((r) => r.week >= FROM)) assert.ok(bank.has(row.body), row.body);
  });
});
