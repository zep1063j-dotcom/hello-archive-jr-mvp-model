import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeChapter, parseChapterKey } from "./chapters.ts";
import {
  buildMonthCard,
  CARD_QUOTES,
  layoutTimeline,
  TIMELINE,
  TIMELINE_TEXT_WIDTH,
  pickQuote,
  seasonOfMonth,
  wrapText,
} from "./month-card.ts";
import type { Entry } from "@/types/archive";

// 글자 한 개가 10px인 가짜 측정 함수
const measure = (text: string) => Array.from(text).length * 10;

describe("글 줄바꿈", () => {
  it("띄어쓰기에서 나누고 줄 너비를 넘지 않는다", () => {
    const lines = wrapText(measure, "아이가 오늘 공룡 블록으로 오래 놀았어요", 120, 5);
    assert.ok(lines.length > 1);
    for (const line of lines) assert.ok(measure(line) <= 120, line);
    assert.equal(lines.join(" "), "아이가 오늘 공룡 블록으로 오래 놀았어요");
  });

  it("너무 긴 한 단어는 글자 단위로 나눈다", () => {
    const lines = wrapText(measure, "가나다라마바사아자차카타파하", 50, 5);
    assert.deepEqual(lines, ["가나다라마", "바사아자차", "카타파하"]);
  });

  it("줄 수를 넘으면 마지막 줄을 …로 줄이고 너비를 지킨다", () => {
    const lines = wrapText(measure, "하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 열", 60, 2);
    assert.equal(lines.length, 2);
    assert.ok(lines[1].endsWith("…"));
    for (const line of lines) assert.ok(measure(line) <= 60, line);
  });

  it("빈 글·여러 공백·줄바꿈을 정리한다", () => {
    assert.deepEqual(wrapText(measure, "   ", 100, 3), []);
    assert.deepEqual(wrapText(measure, "가\n\n  나", 100, 3), ["가 나"]);
  });

  it("아주 긴 글에서도 멈추지 않고 줄 수를 지킨다", () => {
    const lines = wrapText(measure, "가".repeat(5000), 100, 3);
    assert.equal(lines.length, 3);
    assert.ok(lines[2].endsWith("…"));
  });
});

const item = (n: number, answerLength: number) => ({
  dateLabel: `10/${n}`,
  question: `질문 ${n}은 무엇인가요?`,
  answer: "답".repeat(answerLength),
});

describe("앞면(타임라인) 배치", () => {
  // 글자 크기에 비례하는 가짜 측정기: 글자 한 개의 너비 = 크기의 0.9배
  const measureFor = (_kind: "question" | "answer", size: number) => (text: string) => Array.from(text).length * size * 0.9;

  const bottomOf = (layout: NonNullable<ReturnType<typeof layoutTimeline>>) => {
    const last = layout.blocks[layout.blocks.length - 1];
    return (
      last.top +
      last.question.length * layout.scale.questionLineHeight +
      TIMELINE.questionGap +
      last.answer.length * layout.scale.answerLineHeight
    );
  };

  for (const count of [1, 2, 3, 4, 5]) {
    it(`항목 ${count}개가 긴 답이어도 본문 영역 안에 들어가고 순서대로 놓인다`, () => {
      const layout = layoutTimeline(measureFor, Array.from({ length: count }, (_, i) => item(i + 1, 400)));
      assert.ok(layout);
      assert.equal(layout.blocks.length, count);
      let previous = TIMELINE.bodyTop - 1;
      for (const block of layout.blocks) {
        assert.ok(block.top > previous);
        previous = block.top;
        // 질문·답 모두 줄 너비를 넘지 않는다 (겹침·넘침 없음)
        for (const line of block.question) assert.ok(measureFor("question", layout.scale.questionSize)(line) <= TIMELINE_TEXT_WIDTH);
        for (const line of block.answer) assert.ok(measureFor("answer", layout.scale.answerSize)(line) <= TIMELINE_TEXT_WIDTH);
      }
      assert.ok(bottomOf(layout) <= TIMELINE.bodyBottom, `bottom ${bottomOf(layout)}`);
      // 긴 답은 줄어든 것을 알려야 한다
      assert.equal(layout.truncated, true);
    });
  }

  it("기록이 적을수록 글자가 크다 (1개 > 3개 > 5개)", () => {
    const sizeOf = (count: number) =>
      layoutTimeline(measureFor, Array.from({ length: count }, (_, i) => item(i + 1, 20)))!.scale.answerSize;
    assert.ok(sizeOf(1) > sizeOf(2));
    assert.ok(sizeOf(2) > sizeOf(3));
    assert.ok(sizeOf(3) >= sizeOf(4));
    assert.ok(sizeOf(4) > sizeOf(5));
  });

  it("짧은 기록 하나는 크게, 줄여지지 않고 전부 보인다", () => {
    const layout = layoutTimeline(measureFor, [{ dateLabel: "10/27", question: "오늘 뭐 하고 놀았어?", answer: "블록으로 높은 탑을 쌓았어요." }]);
    assert.ok(layout);
    assert.equal(layout.truncated, false);
    assert.ok(layout.scale.answerSize >= 44);
    assert.equal(layout.blocks[0].answer.join(" "), "블록으로 높은 탑을 쌓았어요.");
  });

  it("항목이 적으면 답을 더 길게 보여 준다", () => {
    const few = layoutTimeline(measureFor, [item(1, 400), item(2, 400)])!;
    const many = layoutTimeline(measureFor, [1, 2, 3, 4, 5].map((n) => item(n, 400)))!;
    assert.ok(few.blocks[0].answer.length > many.blocks[0].answer.length);
  });

  it("항목이 없으면 배치가 없다", () => {
    assert.equal(layoutTimeline(measureFor, []), null);
  });

  it("긴 질문(2줄 초과)도 넘치지 않고 줄었음을 알린다", () => {
    const layout = layoutTimeline(measureFor, [
      { dateLabel: "10/27", question: "아주 아주 긴 질문 ".repeat(40), answer: "짧은 답" },
    ])!;
    assert.ok(layout.blocks[0].question.length <= TIMELINE.maxQuestionLines);
    assert.equal(layout.truncated, true);
  });
});

function entry(id: string, createdAt: string, photoUrl?: string): Entry {
  return {
    id,
    question: { id: `q-${id}`, weekStart: createdAt.slice(0, 10), body: `질문 ${id}` },
    body: `답 ${id}`,
    photos: photoUrl ? [{ id: `p-${id}`, url: photoUrl }] : [],
    createdAt,
    updatedAt: createdAt,
  };
}

function chapterOf(entries: Entry[], today = "2026-11-15") {
  const range = parseChapterKey("1m", "2026-10");
  assert.ok(range);
  return makeChapter("1m", range, entries, today);
}

const base = { childId: "child-1", childName: "쫑", birthDate: "2022-05-14", today: "2026-11-15" };

describe("1개월 이야기 카드 만들기", () => {
  const entries = [
    entry("1", "2026-10-05T03:00:00Z"),
    entry("2", "2026-10-12T03:00:00Z", "https://example.test/a.jpg"),
    entry("3", "2026-10-19T03:00:00Z"),
    entry("4", "2026-10-26T03:00:00Z"),
    entry("5", "2026-10-28T03:00:00Z"),
    entry("6", "2026-10-30T03:00:00Z"),
    entry("x", "2026-09-30T03:00:00Z", "https://example.test/old.jpg"), // 다른 달
  ];

  it("기록이 없으면 null", () => {
    assert.equal(buildMonthCard({ ...base, chapter: chapterOf([entries[6]]) }), null);
  });

  it("앞면에는 그 달 최근 5개가 오래된 순으로 들어간다", () => {
    const card = buildMonthCard({ ...base, chapter: chapterOf(entries) });
    assert.ok(card);
    assert.deepEqual(card.items.map((i) => i.answer), ["답 2", "답 3", "답 4", "답 5", "답 6"]);
    // 날짜는 작성일(KST): 2026-10-12T03:00Z → 10/12
    assert.deepEqual(card.items.map((i) => i.dateLabel), ["10/12", "10/19", "10/26", "10/28", "10/30"]);
    assert.equal(card.entryCount, 6);
    assert.equal(card.monthLabel, "10월");
    assert.equal(card.yearLabel, "2026");
  });

  it("뒷면은 그 달의 사진이 있으면 가장 최근 사진, 다른 달 사진은 쓰지 않는다", () => {
    const card = buildMonthCard({ ...base, chapter: chapterOf(entries) });
    assert.deepEqual(card?.back, { kind: "photo", url: "https://example.test/a.jpg" });
    const later = buildMonthCard({
      ...base,
      chapter: chapterOf([...entries, entry("7", "2026-10-31T03:00:00Z", "https://example.test/b.jpg")]),
    });
    assert.deepEqual(later?.back, { kind: "photo", url: "https://example.test/b.jpg" });
  });

  it("사진이 없으면 글귀, 같은 아이·달에는 늘 같은 글귀", () => {
    const noPhoto = [entry("1", "2026-10-05T03:00:00Z"), entry("2", "2026-10-12T03:00:00Z")];
    const a = buildMonthCard({ ...base, chapter: chapterOf(noPhoto) });
    const b = buildMonthCard({ ...base, chapter: chapterOf(noPhoto) });
    assert.equal(a?.back.kind, "quote");
    assert.deepEqual(a?.back, b?.back);
    assert.ok(CARD_QUOTES.includes(a?.quote ?? ""));
  });

  it("나이는 끝난 달이면 그 달 마지막 날, 진행 중이면 오늘 기준", () => {
    const closed = buildMonthCard({ ...base, chapter: chapterOf(entries) });
    assert.equal(closed?.ageLabel, "만 4세 5개월"); // 2022-05-14 → 2026-10-31
    const open = buildMonthCard({
      ...base,
      today: "2026-10-10",
      chapter: chapterOf(entries, "2026-10-10"),
    });
    assert.equal(open?.ageLabel, "만 4세 4개월"); // 2022-05-14 → 2026-10-10 (14일 전이라 한 달 덜)
  });
});

describe("글귀", () => {
  it("글귀 목록은 비어 있지 않고 중복이 없다", () => {
    assert.ok(CARD_QUOTES.length >= 20);
    assert.equal(new Set(CARD_QUOTES).size, CARD_QUOTES.length);
    for (const quote of CARD_QUOTES) assert.ok(quote.length > 0 && quote.length <= 40, quote);
  });

  it("시드마다 목록 안의 글귀를 같게 돌려주고, 시드가 다르면 여러 글귀가 나온다", () => {
    assert.equal(pickQuote("a:2026-10"), pickQuote("a:2026-10"));
    const seen = new Set(Array.from({ length: 40 }, (_, i) => pickQuote(`child-${i}:2026-10`)));
    assert.ok(seen.size > 5);
  });
});

describe("계절별 카드 색", () => {
  it("3~5월 봄, 6~8월 여름, 9~11월 가을, 12~2월 겨울", () => {
    const expected = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
    expected.forEach((season, index) => assert.equal(seasonOfMonth(index + 1), season, `${index + 1}월`));
  });

  it("카드 모델에 월 숫자가 들어간다", () => {
    const card = buildMonthCard({ ...base, chapter: chapterOf([entry("1", "2026-10-05T03:00:00Z")]) });
    assert.equal(card?.month, 10);
  });
});

