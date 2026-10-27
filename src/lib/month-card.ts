// 1개월 이야기 카드의 순수 규칙 (D-029). Next.js·브라우저에 묶이지 않는 순수 TS (D-015).
//  - 앞면: 그 달 기록 중 최근 5개의 질문과 답을 오래된 순으로. 뒷면: 그 달에 올린 사진이 있으면 가장 최근 사진, 없으면 글귀.
//  - 글귀는 지금은 정해 둔 목록에서 고른다. AI가 쓰는 글귀는 정식 출시 때 이 자리에 들어온다(D-029).
//  - 카드는 부모의 기기에서 그려지고 서버로 올라가지 않는다. 이 파일은 "무엇을 어디에 놓는가"만 정한다.
import { addDays, formatAge } from "./date.ts";
import type { Chapter } from "./chapters.ts";

/** 카드 이미지 크기 (4:5 세로형, 인스타그램 등 공유에 흔한 비율) */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

export const MAX_CARD_ITEMS = 5;

export type MonthCardItem = { question: string; answer: string };

export type MonthCardBack =
  | { kind: "photo"; url: string }
  | { kind: "quote"; text: string };

export type MonthCardModel = {
  /** "2026" */
  yearLabel: string;
  /** "10월" */
  monthLabel: string;
  childName: string;
  /** "만 4세 5개월" (그 달 마지막 날, 진행 중인 달은 오늘 기준) */
  ageLabel: string;
  items: MonthCardItem[];
  back: MonthCardBack;
  /** 글귀. 뒷면이 글귀일 때 쓰고, 뒷면 사진을 불러오지 못했을 때의 대체로도 쓴다. */
  quote: string;
  /** 그 달 기록 수 (카드에는 최근 5개만 담긴다) */
  entryCount: number;
};

// 아이와 부모에게 건네는 짧은 글귀. 기록 내용과 상관없이 고르는 문구라 개인정보가 들어가지 않는다.
export const CARD_QUOTES: string[] = [
  "오늘의 한마디가 내일의 보물이 돼요.",
  "아이는 매일 조금씩, 그리고 한꺼번에 자라요.",
  "작은 말 한마디에도 한 달의 마음이 담겨 있어요.",
  "지나가는 하루를 적어 두면, 오래 머무는 기억이 돼요.",
  "오늘도 우리 아이는 자기만의 속도로 자랐어요.",
  "기록은 사랑을 한 번 더 말해 주는 방법이에요.",
  "서툰 발음도, 엉뚱한 질문도 이 시절에만 들을 수 있어요.",
  "한 달 뒤, 일 년 뒤의 우리가 오늘을 웃으며 읽을 거예요.",
  "아이의 하루를 적는 마음이 가장 오래 남아요.",
  "자라는 시간은 천천히, 기록은 차곡차곡.",
  "별일 없던 날도 나중에는 가장 그리운 날이 돼요.",
  "아이의 말 속에는 그날의 세상이 들어 있어요.",
  "함께 보낸 한 달을 가만히 들여다보아요.",
  "작은 습관 하나가 큰 추억을 만들어요.",
  "오늘의 웃음을 내일의 우리에게 남겨요.",
  "어제보다 한 뼘 더, 우리 아이는 자라고 있어요.",
  "다시는 같은 모습으로 오지 않는 시간이에요.",
  "기록하는 동안 부모도 함께 자라요.",
  "아이가 건넨 말을 오래 기억하고 싶어서 적어 두었어요.",
  "이 한 달도 우리 가족의 이야기가 되었어요.",
  "사소해 보여도 모두 소중한 순간이었어요.",
  "한 줄이면 충분해요. 마음이 닿으면 기억이 돼요.",
  "오늘의 질문이 내일의 대화가 돼요.",
  "자라는 아이 곁에서 천천히 적어 내려가요.",
  "시간이 흘러도 이 목소리는 여기 남아 있어요.",
  "하루하루가 모여 한 사람의 이야기가 돼요.",
  "아이의 한 달을 안아 주는 마음으로.",
  "웃음, 투정, 엉뚱한 한마디까지 모두 우리 이야기예요.",
  "오늘 적은 한 줄이 먼 훗날 가장 큰 선물이 돼요.",
  "이만큼 자란 우리 아이, 참 잘하고 있어요.",
];

/** 같은 시드(아이·달)에는 늘 같은 글귀가 나온다 (카드를 다시 열어도 글귀가 바뀌지 않게). */
export function pickQuote(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return CARD_QUOTES[hash % CARD_QUOTES.length];
}

/**
 * 챕터(한 달)로 카드를 만든다. 기록이 없으면 null.
 * 앞면은 최근 5개(오래된 순), 뒷면 사진은 사진이 있는 가장 최근 기록의 첫 사진.
 */
export function buildMonthCard(input: {
  chapter: Chapter;
  childId: string;
  childName: string;
  birthDate: string;
  today: string;
}): MonthCardModel | null {
  const { chapter, childId, childName, birthDate, today } = input;
  if (chapter.entries.length === 0) return null;

  const items = chapter.entries
    .slice(-MAX_CARD_ITEMS)
    .map((entry) => ({ question: entry.question.body, answer: entry.body }));

  // chapter.entries는 오래된 순이라 뒤에서부터 사진이 있는 기록을 찾는다.
  const withPhoto = [...chapter.entries].reverse().find((entry) => entry.photos.length > 0);
  const quote = pickQuote(`${childId}:${chapter.key}`);
  const back: MonthCardBack = withPhoto
    ? { kind: "photo", url: withPhoto.photos[0].url }
    : { kind: "quote", text: quote };

  const ageAt = chapter.isOpen ? today : addDays(chapter.end, -1);
  return {
    yearLabel: chapter.start.slice(0, 4),
    monthLabel: `${Number(chapter.start.slice(5, 7))}월`,
    childName,
    ageLabel: formatAge(birthDate, ageAt),
    items,
    back,
    quote,
    entryCount: chapter.entries.length,
  };
}

// ---- 글자 배치 (캔버스에 그리기 전에 줄을 나누고 위치를 정한다) ----

/** 문자열의 화면 너비. 브라우저에서는 캔버스 `measureText`, 테스트에서는 간단한 가짜 함수를 넘긴다. */
export type MeasureText = (text: string) => number;

function ellipsize(measure: MeasureText, line: string, maxWidth: number): string {
  const chars = Array.from(line.replace(/…$/, ""));
  while (chars.length > 0 && measure(`${chars.join("")}…`) > maxWidth) chars.pop();
  return `${chars.join("").trimEnd()}…`;
}

/**
 * 글을 `maxWidth` 안에서 줄바꿈한다. 띄어쓰기에서 먼저 나누고, 한 단어가 너무 길면 글자 단위로 나눈다.
 * `maxLines`를 넘으면 마지막 줄 끝을 "…"로 줄인다.
 */
export function wrapText(
  measure: MeasureText,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean || maxLines < 1) return [];

  const lines: string[] = [];
  let current = "";
  for (const word of clean.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    // 한 단어가 한 줄보다 길면 글자 단위로 쪼갠다.
    let rest = Array.from(word);
    while (measure(rest.join("")) > maxWidth) {
      let take = 1;
      while (take < rest.length && measure(rest.slice(0, take + 1).join("")) <= maxWidth) take += 1;
      lines.push(rest.slice(0, take).join(""));
      rest = rest.slice(take);
      if (lines.length > maxLines) break;
    }
    current = rest.join("");
    if (lines.length > maxLines) break;
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = ellipsize(measure, kept[maxLines - 1], maxWidth);
  return kept;
}

/** 앞면 배치 상수 (px, 1080×1350 기준). 그리는 코드와 배치 계산이 같은 값을 쓴다. */
export const FRONT = {
  margin: 88,
  bodyTop: 366,
  bodyBottom: 1222,
  questionSize: 30,
  questionLineHeight: 40,
  answerSize: 34,
  answerLineHeight: 50,
  /** 질문과 답 사이 */
  questionGap: 8,
  gapMin: 24,
  gapMax: 52,
  maxQuestionLines: 2,
  maxAnswerLines: 4,
} as const;

export const FRONT_CONTENT_WIDTH = CARD_WIDTH - FRONT.margin * 2;

export type FrontBlock = {
  question: string[];
  answer: string[];
  /** 블록 맨 위 y */
  top: number;
};

/**
 * 앞면 질문·답 블록의 줄과 위치를 정한다. 답을 최대 4줄에서 시작해, 전부 들어갈 때까지 줄 수를 줄인다
 * (항목이 5개면 답은 보통 2줄까지, 적으면 더 길게). 남는 공간은 블록 사이 간격으로 나눈다.
 */
export function layoutFront(
  measureQuestion: MeasureText,
  measureAnswer: MeasureText,
  items: MonthCardItem[],
): FrontBlock[] {
  if (items.length === 0) return [];
  const area = FRONT.bodyBottom - FRONT.bodyTop;

  for (let answerLines = FRONT.maxAnswerLines; answerLines >= 1; answerLines -= 1) {
    const blocks = items.map((item) => ({
      question: wrapText(measureQuestion, item.question, FRONT_CONTENT_WIDTH, FRONT.maxQuestionLines),
      answer: wrapText(measureAnswer, item.answer, FRONT_CONTENT_WIDTH, answerLines),
    }));
    const heights = blocks.map(
      (block) =>
        block.question.length * FRONT.questionLineHeight +
        FRONT.questionGap +
        block.answer.length * FRONT.answerLineHeight,
    );
    const total = heights.reduce((sum, height) => sum + height, 0);
    const gaps = items.length - 1;
    if (total + gaps * FRONT.gapMin > area && answerLines > 1) continue;

    const gap =
      gaps === 0 ? 0 : Math.min(FRONT.gapMax, Math.max(FRONT.gapMin, (area - total) / gaps));
    let top: number = FRONT.bodyTop;
    return blocks.map((block, index) => {
      const placed = { ...block, top };
      top += heights[index] + gap;
      return placed;
    });
  }
  return [];
}
