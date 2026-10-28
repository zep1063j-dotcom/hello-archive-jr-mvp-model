import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeChapter, parseChapterKey } from "./chapters.ts";
import {
  buildMonthCard,
  cardTitle,
  layoutHeader,
  layoutStory,
  MAX_CARD_ITEMS,
  seasonOfMonth,
  STORY,
  STORY_SCALES,
  STORY_WIDTH,
  wrapParagraphs,
  wrapText,
  type MeasureFor,
  type StoryLayout,
} from "./month-card.ts";
import { CARD_THEMES, contrastRatio, SEASON_COLORS } from "./month-card-theme.ts";
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

  it("이모지(ZWJ 가족 이모지·국기)는 글자 단위로 나눌 때도 쪼개지지 않는다", () => {
    const family = "👨‍👩‍👧";
    const flag = "🇰🇷";
    const lines = wrapText(measure, `${family}${flag}${family}${flag}`, 20, 10);
    assert.equal(lines.join(""), `${family}${flag}${family}${flag}`);
    for (const line of lines) assert.ok(!line.startsWith("\u200d") && !line.startsWith("\u{1F1F7}"), line);
  });
});

describe("문단 줄바꿈", () => {
  it("부모가 친 엔터는 줄바꿈으로 남기고 빈 줄은 건너뛴다", () => {
    assert.deepEqual(wrapParagraphs(measure, "첫째 줄\n\n둘째 줄\r\n셋째 줄", 300, 10), ["첫째 줄", "둘째 줄", "셋째 줄"]);
  });

  it("줄 수를 넘으면 마지막 줄을 …로 줄인다", () => {
    const lines = wrapParagraphs(measure, "가\n나\n다\n라", 300, 2);
    assert.equal(lines.length, 2);
    assert.ok(lines[1].endsWith("…"));
  });
});

// 글자 크기에 비례하는 가짜 측정기: 글자 한 개의 너비 = 크기의 0.9배
const measureFor: MeasureFor = (_kind, size) => (text) => Array.from(text).length * size * 0.9;

const item = (n: number, answerLength: number, question = `질문 ${n}은 무엇인가요?`) => ({
  dateLabel: `10월 ${n}일`,
  question,
  answer: "답".repeat(answerLength),
});
const BODY_TOP = 400;

describe("카드 제목", () => {
  it("'○○의 10월 이야기' 형태", () => {
    assert.equal(cardTitle({ childName: "기영이", monthLabel: "10월" }), "기영이의 10월 이야기");
  });

  it("긴 별명도 두 줄 안에 들어가고 제목 영역 아래에서 본문이 시작한다", () => {
    const long = layoutHeader(measureFor, cardTitle({ childName: "아주아주긴별명".repeat(4), monthLabel: "10월" }));
    const short = layoutHeader(measureFor, cardTitle({ childName: "쫑", monthLabel: "10월" }));
    assert.ok(long.titleLines.length <= 2);
    assert.equal(short.titleLines.length, 1);
    assert.ok(long.bodyTop > short.bodyTop);
    for (const line of long.titleLines) assert.ok(measureFor("title", long.titleSize)(line) <= STORY_WIDTH);
  });
});

describe("이야기 면 배치", () => {
  const bottomOf = (layout: StoryLayout) => {
    const last = layout.blocks[layout.blocks.length - 1];
    const { scale } = layout;
    return (
      last.top +
      last.answer.length * scale.answerLineHeight +
      STORY.answerGap +
      STORY.dateLineHeight +
      STORY.dateGap +
      last.question.length * scale.questionLineHeight
    );
  };

  for (const count of [1, 2, 3, 4]) {
    for (const answerLength of [10, 120, 400, 4000]) {
      it(`기록 ${count}개·답 ${answerLength}자: 본문 영역 안에 순서대로 놓이고 줄 너비를 넘지 않는다`, () => {
        const items = Array.from({ length: count }, (_, i) => item(i + 1, answerLength));
        const layout = layoutStory(measureFor, items, BODY_TOP);
        assert.ok(layout);
        assert.ok(layout.shownCount >= 1 && layout.shownCount <= count);
        assert.equal(layout.blocks.length, layout.shownCount);
        // 최근 기록부터 담긴다
        assert.deepEqual(layout.blocks.map((b) => b.dateLabel), items.slice(-layout.shownCount).map((i) => i.dateLabel));
        let previous = BODY_TOP - 1;
        for (const block of layout.blocks) {
          assert.ok(block.top > previous);
          previous = block.top;
          for (const line of block.answer) assert.ok(measureFor("answer", layout.scale.answerSize)(line) <= layout.textWidth);
          for (const line of block.question) assert.ok(measureFor("question", layout.scale.questionSize)(line) <= layout.textWidth);
        }
        assert.ok(bottomOf(layout) <= STORY.bodyBottom, `bottom ${bottomOf(layout)}`);
        // 구분선은 항목 사이에만, 블록 사이 간격 안에 있다
        layout.blocks.forEach((block, i) => {
          if (i === layout.blocks.length - 1) assert.equal(block.dividerY, undefined);
          else {
            assert.ok(block.dividerY !== undefined && block.dividerY > bottomOf({ ...layout, blocks: [block] }) - 1);
            assert.ok(block.dividerY < layout.blocks[i + 1].top);
          }
        });
      });
    }
  }

  it("글을 조용히 자르지 않는다: 줄어든 답은 truncated로 알리고, 들어가면 원문 그대로다", () => {
    const fits = layoutStory(measureFor, [item(1, 40), item(2, 40)], BODY_TOP)!;
    assert.equal(fits.truncated, false);
    assert.equal(fits.shownCount, 2);
    for (const [i, block] of fits.blocks.entries()) assert.equal(block.answer.join(""), "답".repeat(40), `${i}`);

    const tooLong = layoutStory(measureFor, [item(1, 4000)], BODY_TOP)!;
    assert.equal(tooLong.truncated, true);
    assert.equal(tooLong.scale, STORY_SCALES[STORY_SCALES.length - 1]);
  });

  it("글이 길어 여럿이 안 들어가면 오래된 기록부터 빼고, 담긴 기록은 줄이지 않는다", () => {
    const layout = layoutStory(measureFor, [1, 2, 3, 4].map((n) => item(n, 300)), BODY_TOP)!;
    assert.ok(layout.shownCount < 4);
    assert.equal(layout.truncated, false);
    for (const block of layout.blocks) assert.equal(block.answer.join(""), "답".repeat(300));
    assert.equal(layout.blocks.at(-1)!.dateLabel, "10월 4일");
  });

  it("바닥 글자 크기(34px) 아래로는 줄이지 않는다", () => {
    const floor = STORY_SCALES[STORY_SCALES.length - 1].answerSize;
    assert.equal(floor, 34);
    for (const length of [100, 300, 1000]) {
      const layout = layoutStory(measureFor, [item(1, length), item(2, length)], BODY_TOP)!;
      assert.ok(layout.scale.answerSize >= floor);
    }
  });

  it("질문은 언제나 답보다 작고 차분하다 (답이 주인공, D-047)", () => {
    for (const scale of STORY_SCALES) {
      assert.ok(scale.questionSize < scale.answerSize);
      assert.ok(scale.questionLineHeight < scale.answerLineHeight);
    }
  });

  it("기록이 적을수록 글자가 크다 (1개 > 2개 > 3개 ≥ 4개)", () => {
    const sizeOf = (count: number) =>
      layoutStory(measureFor, Array.from({ length: count }, (_, i) => item(i + 1, 10)), BODY_TOP)!.scale.answerSize;
    assert.ok(sizeOf(1) > sizeOf(2));
    assert.ok(sizeOf(2) > sizeOf(3));
    assert.ok(sizeOf(3) >= sizeOf(4));
  });

  it("짧은 기록 하나는 인용 카드로 크게, 원문 그대로 전부 보인다", () => {
    const layout = layoutStory(measureFor, [{ dateLabel: "10월 27일", question: "오늘 뭐 하고 놀았어?", answer: "블록으로 높은 탑을 쌓았어요." }], BODY_TOP)!;
    assert.equal(layout.truncated, false);
    assert.equal(layout.shownCount, 1);
    assert.equal(layout.scale.answerSize, 64);
    assert.equal(layout.textWidth, STORY_WIDTH - STORY.quoteIndent);
    assert.equal(layout.blocks[0].answer.join(" "), "블록으로 높은 탑을 쌓았어요.");
  });

  it("줄바꿈이 있는 답은 줄을 살려서 놓는다", () => {
    const layout = layoutStory(measureFor, [{ dateLabel: "10월 27일", question: "질문", answer: "첫 줄\n\n둘째 줄" }], BODY_TOP)!;
    assert.deepEqual(layout.blocks[0].answer, ["첫 줄", "둘째 줄"]);
  });

  it("기록이 없으면 배치가 없다", () => {
    assert.equal(layoutStory(measureFor, [], BODY_TOP), null);
  });

  it("긴 질문(6줄 초과)도 넘치지 않고 줄었음을 알린다", () => {
    const layout = layoutStory(measureFor, [item(1, 10, "아주 아주 긴 질문 ".repeat(60))], BODY_TOP)!;
    assert.ok(layout.blocks[0].question.length <= STORY.maxQuestionLines);
    assert.equal(layout.truncated, true);
    assert.ok(bottomOf(layout) <= STORY.bodyBottom);
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

const base = { childName: "쫑", birthDate: "2022-05-14", today: "2026-11-15" };

describe("월별 이야기 카드 만들기", () => {
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

  it(`이야기 면 후보는 그 달 최근 ${MAX_CARD_ITEMS}개가 오래된 순으로 들어간다`, () => {
    const card = buildMonthCard({ ...base, chapter: chapterOf(entries) });
    assert.ok(card);
    assert.deepEqual(card.items.map((i) => i.answer), ["답 3", "답 4", "답 5", "답 6"]);
    // 날짜는 작성일(KST): 2026-10-19T03:00Z → 10월 19일
    assert.deepEqual(card.items.map((i) => i.dateLabel), ["10월 19일", "10월 26일", "10월 28일", "10월 30일"]);
    assert.equal(card.entryCount, 6);
    assert.equal(card.monthLabel, "10월");
    assert.equal(card.yearLabel, "2026");
  });

  it("사진 면은 그 달의 사진이 있으면 가장 최근 사진과 그 기록 날짜, 다른 달 사진은 쓰지 않는다", () => {
    const card = buildMonthCard({ ...base, chapter: chapterOf(entries) });
    assert.deepEqual(card?.photo, { url: "https://example.test/a.jpg", dateLabel: "10월 12일" });
    const later = buildMonthCard({
      ...base,
      chapter: chapterOf([...entries, entry("7", "2026-10-31T03:00:00Z", "https://example.test/b.jpg")]),
    });
    assert.deepEqual(later?.photo, { url: "https://example.test/b.jpg", dateLabel: "10월 31일" });
  });

  it("사진이 없으면 사진 면이 없다 (빈 면을 만들지 않는다)", () => {
    const noPhoto = [entry("1", "2026-10-05T03:00:00Z"), entry("2", "2026-10-12T03:00:00Z")];
    assert.equal(buildMonthCard({ ...base, chapter: chapterOf(noPhoto) })?.photo, null);
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

describe("계절별 카드 색", () => {
  it("3~5월 봄, 6~8월 여름, 9~11월 가을, 12~2월 겨울", () => {
    const expected = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
    expected.forEach((season, index) => assert.equal(seasonOfMonth(index + 1), season, `${index + 1}월`));
  });

  it("계절 색은 지정한 값 그대로다", () => {
    assert.deepEqual(SEASON_COLORS.spring, { background: "#F5DFE5", ink: "#572C43", accent: "#46745A" });
    assert.deepEqual(SEASON_COLORS.summer, { background: "#DCECF5", ink: "#183E70", accent: "#D65A28" });
    assert.deepEqual(SEASON_COLORS.autumn, { background: "#F1DDC5", ink: "#593723", accent: "#A64232" });
    assert.deepEqual(SEASON_COLORS.winter, { background: "#E5E5F2", ink: "#353553", accent: "#465BB0" });
  });

  it("카드 모델의 달은 기록한 달이고, 오늘 날짜가 달라도 같은 계절이다 (과거 카드를 다시 만들어도 그 달 색)", () => {
    const march = parseChapterKey("1m", "2026-03");
    assert.ok(march);
    const entriesOfMarch = [entry("m", "2026-03-10T03:00:00Z")];
    for (const today of ["2026-03-20", "2026-12-25", "2027-08-01"]) {
      const card = buildMonthCard({ ...base, today, chapter: makeChapter("1m", march, entriesOfMarch, today) });
      assert.equal(card?.month, 3);
      assert.equal(seasonOfMonth(card!.month), "spring");
    }
  });

  it("12월과 다음 해 1월은 모두 겨울 테마다", () => {
    const dec = parseChapterKey("1m", "2026-12");
    const jan = parseChapterKey("1m", "2027-01");
    assert.ok(dec && jan);
    const decCard = buildMonthCard({ ...base, today: "2027-02-01", chapter: makeChapter("1m", dec, [entry("d", "2026-12-24T03:00:00Z")], "2027-02-01") });
    const janCard = buildMonthCard({ ...base, today: "2027-02-01", chapter: makeChapter("1m", jan, [entry("j", "2027-01-05T03:00:00Z")], "2027-02-01") });
    assert.equal(decCard?.month, 12);
    assert.equal(janCard?.month, 1);
    assert.equal(seasonOfMonth(decCard!.month), "winter");
    assert.equal(seasonOfMonth(janCard!.month), "winter");
    assert.equal(CARD_THEMES[seasonOfMonth(12)], CARD_THEMES[seasonOfMonth(1)]);
  });

  it("글자색은 모든 계절·면 바탕 위에서 읽기 쉽다 (대비 4.5 이상)", () => {
    for (const [season, theme] of Object.entries(CARD_THEMES)) {
      for (const background of [theme.background, theme.photoBackground]) {
        for (const text of [theme.ink, theme.soft, theme.mute]) {
          assert.ok(contrastRatio(text, background) >= 4.5, `${season} ${text} on ${background}: ${contrastRatio(text, background).toFixed(2)}`);
        }
      }
      // 포인트색은 점·선에만 쓰므로 바탕과 구분만 되면 된다
      assert.ok(contrastRatio(theme.accent, theme.background) >= 2.5, `${season} accent`);
      assert.ok(contrastRatio(theme.line, theme.background) >= 1.2, `${season} line`);
    }
  });

  it("사진 면 바탕은 같은 계열의 옅은 색이다 (이야기 면 바탕보다 밝다)", () => {
    for (const theme of Object.values(CARD_THEMES)) {
      assert.ok(contrastRatio(theme.photoBackground, "#ffffff") < contrastRatio(theme.background, "#ffffff"));
    }
  });
});
