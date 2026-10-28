// 월별 이야기 카드의 순수 규칙 (D-029, D-048). Next.js·브라우저에 묶이지 않는 순수 TS (D-015).
//  - 이야기 면: 그 달 기록 중 최근 몇 개의 답·날짜·질문. 아이의 답이 가장 크고, 질문은 작고 차분하게 둔다.
//  - 사진 면: 그 달에 올린 사진이 있으면 가장 최근 사진 한 장과 날짜. 사진이 없으면 사진 면 자체가 없다(빈 면을 저장하게 하지 않는다).
//  - 카드는 부모의 기기에서 그려지고 서버로 올라가지 않는다. 이 파일은 "무엇을 어디에 놓는가"만 정한다.
import { addDays, formatAge, toKstDateKey } from "./date.ts";
import type { Chapter } from "./chapters.ts";

/** 카드 이미지 크기 (4:5 세로형, 인스타그램 등 공유에 흔한 비율) */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

/** 이야기 면에 담을 수 있는 기록의 최대 수. 글이 길면 이보다 적게(최근 것부터) 담긴다. */
export const MAX_CARD_ITEMS = 4;

/** `dateLabel`은 기록을 쓴 날(KST)의 "10월 27일" 형태 */
export type MonthCardItem = { dateLabel: string; question: string; answer: string };

export type MonthCardPhoto = { url: string; dateLabel: string };

export type Season = "spring" | "summer" | "autumn" | "winter";

/** 카드 색을 정하는 계절: 3~5월 봄, 6~8월 여름, 9~11월 가을, 12~2월 겨울 (D-048). 12월과 다음 해 1·2월은 모두 겨울이다. */
export function seasonOfMonth(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export type MonthCardModel = {
  /** 카드 대상 달 1~12 (계절 색의 기준. 오늘 날짜가 아니다) */
  month: number;
  /** "2026" */
  yearLabel: string;
  /** "10월" */
  monthLabel: string;
  childName: string;
  /** "만 4세 5개월" (그 달 마지막 날, 진행 중인 달은 오늘 기준) */
  ageLabel: string;
  /** 이야기 면 후보: 그 달 최근 기록 (오래된 순). 실제로 몇 개가 담기는지는 글 길이에 따라 배치가 정한다. */
  items: MonthCardItem[];
  /** 사진 면. 그 달에 올린 사진이 없으면 null */
  photo: MonthCardPhoto | null;
  /** 그 달 기록 수 */
  entryCount: number;
};

function koreanMonthDay(dateKey: string): string {
  const [, month, day] = dateKey.split("-").map(Number);
  return `${month}월 ${day}일`;
}

/** 카드 제목: "기영이의 10월 이야기" */
export function cardTitle(model: Pick<MonthCardModel, "childName" | "monthLabel">): string {
  return `${model.childName}의 ${model.monthLabel} 이야기`;
}

/**
 * 챕터(한 달)로 카드를 만든다. 기록이 없으면 null.
 * 이야기 면 후보는 최근 기록(오래된 순), 사진 면은 사진이 있는 가장 최근 기록의 첫 사진.
 * 달·계절은 챕터의 시작월에서 오므로 과거 카드를 오늘 다시 만들어도 그 달 그대로다.
 */
export function buildMonthCard(input: {
  chapter: Chapter;
  childName: string;
  birthDate: string;
  today: string;
}): MonthCardModel | null {
  const { chapter, childName, birthDate, today } = input;
  if (chapter.entries.length === 0) return null;

  const items = chapter.entries.slice(-MAX_CARD_ITEMS).map((entry) => ({
    dateLabel: koreanMonthDay(toKstDateKey(entry.createdAt)),
    question: entry.question.body,
    answer: entry.body,
  }));

  // chapter.entries는 오래된 순이라 뒤에서부터 사진이 있는 기록을 찾는다.
  const withPhoto = [...chapter.entries].reverse().find((entry) => entry.photos.length > 0);
  const photo = withPhoto
    ? { url: withPhoto.photos[0].url, dateLabel: koreanMonthDay(toKstDateKey(withPhoto.createdAt)) }
    : null;

  const ageAt = chapter.isOpen ? today : addDays(chapter.end, -1);
  return {
    month: Number(chapter.start.slice(5, 7)),
    yearLabel: chapter.start.slice(0, 4),
    monthLabel: `${Number(chapter.start.slice(5, 7))}월`,
    childName,
    ageLabel: formatAge(birthDate, ageAt),
    items,
    photo,
    entryCount: chapter.entries.length,
  };
}

// ---- 글자 배치 (캔버스에 그리기 전에 줄을 나누고 위치를 정한다) ----

/** 문자열의 화면 너비. 브라우저에서는 캔버스 `measureText`, 테스트에서는 간단한 가짜 함수를 넘긴다. */
export type MeasureText = (text: string) => number;

// 이모지·가족 이모지(ZWJ)·국기처럼 여러 코드 포인트가 한 글자인 것은 줄바꿈 때 쪼개지 않는다.
const graphemeSegmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("ko", { granularity: "grapheme" }) : null;
function graphemes(text: string): string[] {
  return graphemeSegmenter ? Array.from(graphemeSegmenter.segment(text), (part) => part.segment) : Array.from(text);
}

function ellipsize(measure: MeasureText, line: string, maxWidth: number): string {
  const chars = graphemes(line.replace(/…$/, ""));
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
    let rest = graphemes(word);
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


/**
 * 줄바꿈(엔터)을 살려서 줄을 나눈다. 부모가 쓴 문단은 그대로 문단으로 보이고, 빈 줄은 건너뛴다.
 * `maxLines`를 넘으면 마지막 줄 끝을 "…"로 줄인다.
 */
export function wrapParagraphs(measure: MeasureText, text: string, maxWidth: number, maxLines: number): string[] {
  if (maxLines < 1) return [];
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    lines.push(...wrapText(measure, paragraph, maxWidth, maxLines + 1));
    if (lines.length > maxLines) break;
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = ellipsize(measure, kept[maxLines - 1], maxWidth);
  return kept;
}

/** 글자 종류·크기별 너비 측정기. 제목(굵게)·질문·답의 글꼴이 달라 종류와 크기를 받는다. */
export type MeasureFor = (kind: "title" | "question" | "answer", size: number) => MeasureText;

/** 줄이 "…"로 끝났는데 원문은 그렇지 않으면 글이 줄어든 것이다. */
function wasCut(lines: string[], text: string): boolean {
  const last = lines.at(-1);
  return last !== undefined && last.endsWith("…") && !text.trimEnd().endsWith("…");
}

/** 이야기 면 배치 상수 (px, 1080×1350 기준). 그리는 코드와 배치 계산이 같은 값을 쓴다. */
export const STORY = {
  margin: 88,
  /** 본문이 끝나는 y. 아래는 하단 브랜드 자리 */
  bodyBottom: 1214,
  /** 기록이 1개일 때 인용 막대 때문에 글을 안쪽으로 들이는 만큼 */
  quoteIndent: 36,
  /** 답 → 날짜 → 질문 사이 */
  answerGap: 24,
  dateLineHeight: 34,
  dateGap: 6,
  /** 기록이 여럿일 때 항목 사이 간격(가운데에 구분선) */
  gapMin: 60,
  gapMax: 100,
  maxQuestionLines: 6,
} as const;

export const STORY_WIDTH = CARD_WIDTH - STORY.margin * 2;

// ---- 제목 영역 ----

const TITLE_SIZES = [60, 52, 44] as const;

export type HeaderLayout = {
  titleLines: string[];
  titleSize: number;
  titleLineHeight: number;
  /** 첫 제목 줄의 위 y */
  titleTop: number;
  /** 나이 글자의 가운데 y */
  ageY: number;
  /** 짧은 포인트 선의 위 y */
  ruleY: number;
  /** 본문(답)이 시작하는 y */
  bodyTop: number;
};

/** "기영이의 10월 이야기" 제목: 한 줄에 안 들어가면 두 줄, 그래도 길면 글자를 한 단계씩 줄인다. */
export function layoutHeader(measureFor: MeasureFor, title: string): HeaderLayout {
  let titleSize: number = TITLE_SIZES[0];
  let titleLines: string[] = [];
  for (const size of TITLE_SIZES) {
    titleSize = size;
    titleLines = wrapText(measureFor("title", size), title, STORY_WIDTH, 2);
    if (!wasCut(titleLines, title)) break;
  }
  const titleLineHeight = Math.round(titleSize * 1.3);
  const titleTop = 168;
  const titleBottom = titleTop + titleLines.length * titleLineHeight;
  const ageY = titleBottom + 30;
  const ruleY = ageY + 40;
  return { titleLines, titleSize, titleLineHeight, titleTop, ageY, ruleY, bodyTop: ruleY + 6 + 60 };
}

// ---- 본문(기록) 영역 ----

/** 글자 크기·줄 높이. 질문은 언제나 답보다 작고 차분하게 둔다: 시간이 지나 소중해지는 것은 아이의 말이다 (D-047). */
export type StoryScale = {
  answerSize: number;
  answerLineHeight: number;
  questionSize: number;
  questionLineHeight: number;
};

// 앞쪽이 크다. 가장 작은 크기(34px)가 바닥이다: 그보다 작게 줄이지 않고, 안 들어가면 기록을 줄여서 담는다.
export const STORY_SCALES: readonly StoryScale[] = [
  { answerSize: 64, answerLineHeight: 94, questionSize: 28, questionLineHeight: 42 },
  { answerSize: 56, answerLineHeight: 82, questionSize: 27, questionLineHeight: 40 },
  { answerSize: 48, answerLineHeight: 70, questionSize: 26, questionLineHeight: 38 },
  { answerSize: 44, answerLineHeight: 64, questionSize: 26, questionLineHeight: 38 },
  { answerSize: 40, answerLineHeight: 58, questionSize: 25, questionLineHeight: 36 },
  { answerSize: 36, answerLineHeight: 52, questionSize: 24, questionLineHeight: 35 },
  { answerSize: 34, answerLineHeight: 50, questionSize: 24, questionLineHeight: 35 },
];

/** 담는 기록 수(1~4)별로 시작하는 글자 크기의 인덱스. 기록이 적을수록 크게 시작한다. */
const START_SCALE = [0, 2, 4, 5] as const;

export type StoryBlock = {
  answer: string[];
  question: string[];
  dateLabel: string;
  /** 블록 맨 위 y (답 첫 줄의 위) */
  top: number;
  /** 이 블록 아래의 구분선 y (마지막 블록은 없음) */
  dividerY?: number;
};

export type StoryLayout = {
  scale: StoryScale;
  /** 글이 들어갈 너비. 기록이 1개면 인용 막대 때문에 조금 좁다 */
  textWidth: number;
  blocks: StoryBlock[];
  /** 카드에 담긴 기록 수 (최근 것부터) */
  shownCount: number;
  /** 긴 글이 "…"로 줄어 다 담기지 않았다 (기록이 1개이고 가장 작은 글자로도 안 들어갈 때만) */
  truncated: boolean;
};

/**
 * 이야기 면의 줄과 위치를 정한다. 글을 줄이지 않고 담는 것이 우선이다:
 *  1) 최근 기록 `MAX_CARD_ITEMS`개부터, 기록 수에 맞는 글자 크기에서 시작해 한 단계씩 줄여 가며 전부 들어갈 때까지 맞춘다.
 *  2) 가장 작은 글자(바닥)로도 안 들어가면 가장 오래된 기록부터 빼고 다시 맞춘다(`shownCount`로 알린다).
 *  3) 기록 1개도 안 들어갈 만큼 길 때만 답을 "…"로 줄이고 `truncated`로 알린다.
 * 남는 공간은 항목 사이 간격으로 나눈다(구분선은 간격의 가운데).
 */
export function layoutStory(
  measureFor: MeasureFor,
  allItems: MonthCardItem[],
  bodyTop: number,
): StoryLayout | null {
  if (allItems.length === 0) return null;
  const area = STORY.bodyBottom - bodyTop;

  for (let count = Math.min(allItems.length, MAX_CARD_ITEMS); count >= 1; count -= 1) {
    const items = allItems.slice(-count);
    const textWidth = count === 1 ? STORY_WIDTH - STORY.quoteIndent : STORY_WIDTH;
    const gaps = count - 1;

    for (let index = START_SCALE[count - 1]; index < STORY_SCALES.length; index += 1) {
      const scale = STORY_SCALES[index];
      const lastScale = index === STORY_SCALES.length - 1;
      const fixed = STORY.answerGap + STORY.dateLineHeight + STORY.dateGap;
      const questionMeasure = measureFor("question", scale.questionSize);
      const answerMeasure = measureFor("answer", scale.answerSize);
      const questions = items.map((item) =>
        wrapParagraphs(questionMeasure, item.question, textWidth, STORY.maxQuestionLines),
      );
      const questionsHeight = questions.reduce((sum, lines) => sum + lines.length * scale.questionLineHeight, 0);
      // 답에 쓸 수 있는 줄 수: 한 블록에 줄 수가 넘치면 그 크기는 실패, 1개이고 바닥 크기면 남은 줄만 쓴다.
      const answerBudget = Math.floor((area - gaps * STORY.gapMin - questionsHeight - count * fixed) / scale.answerLineHeight);
      const cutToFit = count === 1 && lastScale;
      if (answerBudget < count && !cutToFit) continue;

      const answers = items.map((item) =>
        wrapParagraphs(answerMeasure, item.answer, textWidth, Math.max(answerBudget, 1) + 1),
      );
      const answerLines = answers.reduce((sum, lines) => sum + lines.length, 0);
      if (answerLines > answerBudget && !cutToFit) continue;

      // 바닥 크기에서 기록 1개: 남는 줄만큼만 담고 줄인다.
      const fitted = cutToFit ? [wrapParagraphs(answerMeasure, items[0].answer, textWidth, Math.max(answerBudget, 1))] : answers;
      const heights = items.map(
        (_, i) =>
          fitted[i].length * scale.answerLineHeight + fixed + questions[i].length * scale.questionLineHeight,
      );
      const total = heights.reduce((sum, height) => sum + height, 0);
      const gap = gaps === 0 ? 0 : Math.min(STORY.gapMax, Math.max(STORY.gapMin, (area - total) / gaps));
      // 기록이 1개면 인용 카드답게 본문 영역의 윗부분(약 35% 지점)에 놓아 아래가 휑하지 않게 한다.
      let top = bodyTop + (count === 1 ? Math.floor((area - total) * 0.35) : 0);
      const blocks = items.map((item, i): StoryBlock => {
        const block: StoryBlock = {
          answer: fitted[i],
          question: questions[i],
          dateLabel: item.dateLabel,
          top,
          dividerY: i < gaps ? top + heights[i] + gap / 2 : undefined,
        };
        top += heights[i] + gap;
        return block;
      });
      const truncated = blocks.some(
        (block, i) => wasCut(block.answer, items[i].answer) || wasCut(block.question, items[i].question),
      );
      return { scale, textWidth, blocks, shownCount: count, truncated };
    }
  }
  return null;
}
