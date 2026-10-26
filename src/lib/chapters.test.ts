// 챕터 구간 단위 테스트 (SESSION 06). 실행: npm run test:unit
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildChapters,
  chapterRangeOf,
  chapterSpanLabel,
  chapterTitle,
  makeChapter,
  parseChapterKey,
} from "./chapters.ts";
import type { Entry } from "../types/archive.ts";

function entryAt(id: string, createdAt: string): Entry {
  return {
    id,
    body: "본문",
    photos: [],
    createdAt,
    updatedAt: createdAt,
    question: { id: `q-${id}`, weekStart: "2026-01-05", body: "질문" },
  };
}

describe("구간 정의 (반개구간 [start, end))", () => {
  for (const [label, period, date, key, start, end] of [
    ["월: 10월", "1m", "2026-10-15", "2026-10", "2026-10-01", "2026-11-01"],
    ["월: 말일", "1m", "2026-10-31", "2026-10", "2026-10-01", "2026-11-01"],
    ["월: 12월은 다음 해 1월 1일에 끝남", "1m", "2026-12-05", "2026-12", "2026-12-01", "2027-01-01"],
    ["월: 윤년 2월", "1m", "2028-02-29", "2028-02", "2028-02-01", "2028-03-01"],
    ["분기: 1분기 시작", "3m", "2026-01-01", "2026-q1", "2026-01-01", "2026-04-01"],
    ["분기: 1분기 끝", "3m", "2026-03-31", "2026-q1", "2026-01-01", "2026-04-01"],
    ["분기: 2분기 시작", "3m", "2026-04-01", "2026-q2", "2026-04-01", "2026-07-01"],
    ["분기: 4분기", "3m", "2026-11-20", "2026-q4", "2026-10-01", "2027-01-01"],
    ["연", "1y", "2026-07-04", "2026", "2026-01-01", "2027-01-01"],
  ] as const) {
    it(label, () => {
      assert.deepEqual(chapterRangeOf(period, date), { key, start, end });
    });
  }
});

describe("식별자 해석", () => {
  it("올바른 식별자는 같은 구간으로 돌아온다", () => {
    assert.deepEqual(parseChapterKey("1m", "2026-10"), chapterRangeOf("1m", "2026-10-01"));
    assert.deepEqual(parseChapterKey("3m", "2026-q4"), chapterRangeOf("3m", "2026-10-01"));
    assert.deepEqual(parseChapterKey("1y", "2026"), chapterRangeOf("1y", "2026-01-01"));
  });

  for (const [period, key] of [
    ["1m", "2026-13"],
    ["1m", "2026-00"],
    ["1m", "2026-1"],
    ["1m", "2026-q1"],
    ["3m", "2026-q5"],
    ["3m", "2026-Q1"],
    ["3m", "2026-10"],
    ["1y", "26"],
    ["1y", "0000"],
    ["1y", "2026-10"],
    ["1y", ""],
  ] as const) {
    it(`${period} "${key}"는 거부한다`, () => {
      assert.equal(parseChapterKey(period, key), null);
    });
  }
});

describe("제목·기간 표시", () => {
  it("제목", () => {
    assert.equal(chapterTitle("1m", chapterRangeOf("1m", "2026-10-15")), "2026년 10월");
    assert.equal(chapterTitle("3m", chapterRangeOf("3m", "2026-10-15")), "2026년 4분기");
    assert.equal(chapterTitle("1y", chapterRangeOf("1y", "2026-10-15")), "2026년");
  });

  it("끝 날짜는 end의 하루 전", () => {
    assert.equal(chapterSpanLabel(chapterRangeOf("1m", "2028-02-10")), "2월 1일 ~ 2월 29일");
    assert.equal(chapterSpanLabel(chapterRangeOf("3m", "2026-11-10")), "10월 1일 ~ 12월 31일");
    assert.equal(chapterSpanLabel(chapterRangeOf("1y", "2026-11-10")), "1월 1일 ~ 12월 31일");
  });
});

describe("기록 소속은 작성일의 한국 시간 날짜 기준", () => {
  const sep30Last = entryAt("a", "2026-09-30T14:59:59Z"); // KST 9/30 23:59:59
  const oct1First = entryAt("b", "2026-09-30T15:00:00Z"); // KST 10/1 00:00:00
  const dec31Last = entryAt("c", "2026-12-31T14:59:59Z"); // KST 12/31 23:59:59
  const jan1First = entryAt("d", "2026-12-31T15:00:00Z"); // KST 2027-01-01 00:00:00
  const all = [jan1First, dec31Last, oct1First, sep30Last];

  it("월 경계: UTC로는 9/30이어도 KST 10/1이면 10월 챕터", () => {
    const sep = makeChapter("1m", parseChapterKey("1m", "2026-09")!, all, "2027-02-01");
    const oct = makeChapter("1m", parseChapterKey("1m", "2026-10")!, all, "2027-02-01");
    assert.deepEqual(sep.entries.map((e) => e.id), ["a"]);
    assert.deepEqual(oct.entries.map((e) => e.id), ["b"]);
  });

  it("분기 경계: 3분기 마지막 순간 / 4분기 첫 순간", () => {
    const q3 = makeChapter("3m", parseChapterKey("3m", "2026-q3")!, all, "2027-02-01");
    const q4 = makeChapter("3m", parseChapterKey("3m", "2026-q4")!, all, "2027-02-01");
    assert.deepEqual(q3.entries.map((e) => e.id), ["a"]);
    assert.deepEqual(q4.entries.map((e) => e.id), ["b", "c"]);
  });

  it("연 경계: 12/31 23:59 KST는 2026년, 1/1 00:00 KST는 2027년", () => {
    const y26 = makeChapter("1y", parseChapterKey("1y", "2026")!, all, "2027-02-01");
    const y27 = makeChapter("1y", parseChapterKey("1y", "2027")!, all, "2027-02-01");
    assert.deepEqual(y26.entries.map((e) => e.id), ["a", "b", "c"]);
    assert.deepEqual(y27.entries.map((e) => e.id), ["d"]);
  });

  it("모든 기록은 어느 기간 종류에서든 정확히 한 챕터에 속한다", () => {
    for (const period of ["1m", "3m", "1y"] as const) {
      const chapters = buildChapters(all, period, "2027-02-01");
      const ids = chapters.flatMap((c) => c.entries.map((e) => e.id)).sort();
      assert.deepEqual(ids, ["a", "b", "c", "d"]);
    }
  });
});

describe("챕터 목록", () => {
  const entries = [
    entryAt("late", "2026-10-25T03:00:00Z"),
    entryAt("mid", "2026-10-05T03:00:00Z"),
    entryAt("early", "2026-08-10T03:00:00Z"),
  ];

  it("기록이 있는 챕터만, 최신 챕터 먼저, 챕터 안은 오래된 기록부터", () => {
    const chapters = buildChapters(entries, "1m", "2026-10-25");
    assert.deepEqual(chapters.map((c) => c.key), ["2026-10", "2026-08"]);
    assert.deepEqual(chapters[0].entries.map((e) => e.id), ["mid", "late"]);
  });

  it("기록이 없으면 챕터도 없다", () => {
    assert.deepEqual(buildChapters([], "3m", "2026-10-25"), []);
  });

  it("끝나지 않은 구간만 진행 중(isOpen)", () => {
    const [oct, aug] = buildChapters(entries, "1m", "2026-10-25");
    assert.equal(oct.isOpen, true);
    assert.equal(aug.isOpen, false);
    // 10월 마지막 날은 아직 진행 중, 11월 1일부터 완결
    assert.equal(buildChapters(entries, "1m", "2026-10-31")[0].isOpen, true);
    assert.equal(buildChapters(entries, "1m", "2026-11-01")[0].isOpen, false);
  });
});
