import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeChapter, parseChapterKey } from "./chapters.ts";
import {
  buildMonthCard,
  cardTitle,
  ALBUM,
  ALBUM_WIDTH,
  albumFrames,
  albumGroups,
  layoutAlbumHeader,
  layoutAlbumStories,
  seasonOfMonth,
  wrapParagraphs,
  wrapText,
  type MeasureFor,
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

describe("앨범 배치와 대화 페이지", () => {
  for (const count of [1, 2, 3, 4, 5]) {
    it(`사진 ${count}칸은 서로 겹치지 않고 카드 안에 놓인다`, () => {
      const frames = albumFrames(count);
      assert.equal(frames.length, count);
      for (const [index, frame] of frames.entries()) {
        assert.ok(frame.x >= 0 && frame.y >= 0);
        assert.ok(frame.x + frame.width <= 1080 && frame.y + frame.height <= 1350);
        assert.ok(frame.height > 64);
        for (const other of frames.slice(index + 1)) {
          assert.ok(frame.x + frame.width <= other.x || other.x + other.width <= frame.x || frame.y + frame.height <= other.y || other.y + other.height <= frame.y);
        }
      }
      if (count === 4) assert.ok(frames.every((frame) => frame.width === frames[0].width && frame.height === frames[0].height));
      if (count === 5) assert.ok(frames[0].width > frames[1].width);
    });
  }

  it("긴 별명에도 제목 아래로 본문을 옮긴다", () => {
    const long = layoutAlbumHeader(measureFor, cardTitle({ childName: "아주아주긴별명".repeat(4), monthLabel: "10월" }));
    const short = layoutAlbumHeader(measureFor, cardTitle({ childName: "쫑", monthLabel: "10월" }));
    assert.ok(long.bodyTop > short.bodyTop);
    assert.ok(long.titleLines.length <= 2);
    for (const line of long.titleLines) assert.ok(measureFor("title", long.titleSize)(line) <= ALBUM_WIDTH);
  });

  it("5개의 짧은 질문과 답은 한 뒷면에 날짜순으로 담긴다", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ dateLabel: `10월 ${i + 1}일`, question: "오늘 뭐 했어?", answer: "같이 놀았어요." }));
    const pages = layoutAlbumStories(measureFor, items, 248);
    assert.equal(pages.length, 1);
    assert.deepEqual(pages[0].map((block) => block.dateLabel), items.map((item) => item.dateLabel));
    assert.ok(ALBUM.questionSize < ALBUM.answerSize);
  });

  it("긴 질문과 5000자 답변도 글을 빼거나 줄이지 않고 다음 장으로 이어진다", () => {
    const question = "질".repeat(100);
    const answer = "답".repeat(5000);
    const pages = layoutAlbumStories(measureFor, [{ dateLabel: "10월 1일", question, answer }], 308);
    assert.ok(pages.length > 1);
    assert.equal(pages.flat().flatMap((block) => block.question).join(""), question);
    assert.equal(pages.flat().flatMap((block) => block.answer).join(""), answer);
    assert.equal(pages[0][0].continued, false);
    assert.ok(pages.slice(1).every((page) => page[0].continued));
    for (const page of pages) {
      let previous = 308;
      for (const block of page) {
        assert.ok(block.top >= previous);
        assert.ok(block.bottom <= ALBUM.bodyBottom);
        previous = block.bottom;
      }
    }
  });

  it("5개를 넘는 기록은 앞뒷면 묶음을 더 만들고 순서와 사진 연결을 유지한다", () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ dateLabel: `${i}`, question: `질문 ${i}`, answer: `답 ${i}`, photoUrl: `photo-${i}` }));
    const groups = albumGroups(items);
    assert.deepEqual(groups.map((group) => group.length), [5, 5, 1]);
    assert.deepEqual(groups.flat(), items);
  });

  it("엔터와 가족 이모지를 보존하고 여러 기록의 답을 모두 담는다", () => {
    const items = [{ dateLabel: "1일", question: "질문", answer: "👨‍👩‍👧".repeat(40) + "\n둘째 줄" }, { dateLabel: "2일", question: "다른 질문", answer: "끝" }];
    const blocks = layoutAlbumStories(measureFor, items, 248).flat();
    assert.equal(blocks.filter((block) => block.dateLabel === "1일").flatMap((block) => block.answer).join(""), "👨‍👩‍👧".repeat(40) + "둘째 줄");
    assert.equal(blocks.at(-1)?.answer.at(-1), "끝");
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

  it("그 달의 모든 기록이 오래된 순으로 들어간다", () => {
    const card = buildMonthCard({ ...base, chapter: chapterOf(entries) });
    assert.ok(card);
    assert.deepEqual(card.items.map((i) => i.answer), ["답 1", "답 2", "답 3", "답 4", "답 5", "답 6"]);
    // 날짜는 작성일(KST): 2026-10-19T03:00Z → 10월 19일
    assert.deepEqual(card.items.map((i) => i.dateLabel), ["10월 5일", "10월 12일", "10월 19일", "10월 26일", "10월 28일", "10월 30일"]);
    assert.equal(card.entryCount, 6);
    assert.equal(card.monthLabel, "10월");
    assert.equal(card.yearLabel, "2026");
  });

  it("각 기록의 첫 사진과 날짜를 연결하고, 사진이 없는 기록도 남긴다", () => {
    const card = buildMonthCard({ ...base, chapter: chapterOf(entries) });
    assert.equal(card?.items[1].photoUrl, "https://example.test/a.jpg");
    assert.equal(card?.items[1].dateLabel, "10월 12일");
    assert.equal(card?.items[0].photoUrl, undefined);
    assert.ok(card?.items.every((item) => item.photoUrl !== "https://example.test/old.jpg"));
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
