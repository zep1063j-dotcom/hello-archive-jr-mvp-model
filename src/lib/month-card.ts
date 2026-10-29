// 월별 이야기 카드의 순수 규칙 (D-029, D-048). Next.js·브라우저에 묶이지 않는 순수 TS (D-015).
//  - 앞면은 날짜·사진 앨범, 뒷면은 같은 기록의 날짜·질문·답 목록이다.
//  - 다섯 기록씩 묶고, 긴 글은 뒷면을 추가해 원문을 모두 담는다.
//  - 카드는 부모의 기기에서 그려지고 서버로 올라가지 않는다. 이 파일은 "무엇을 어디에 놓는가"만 정한다.
import { addDays, formatAge, toKstDateKey } from "./date.ts";
import type { Chapter } from "./chapters.ts";

/** 카드 이미지 크기 (4:5 세로형, 인스타그램 등 공유에 흔한 비율) */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

/** 앨범 한 묶음(앞면 + 뒷면)에 담는 기록 수. */
export const MAX_CARD_ITEMS = 5;

/** `dateLabel`은 기록을 쓴 날(KST)의 "10월 27일" 형태 */
export type MonthCardItem = { dateLabel: string; question: string; answer: string; photoUrl?: string };

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
  /** 그 달의 모든 기록, 오래된 순. 사진과 대화가 같은 순서를 쓴다. */
  items: MonthCardItem[];
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
 * 모든 기록을 오래된 순으로 담으며, 각 기록의 첫 사진을 앞면에 쓴다.
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

  const items = chapter.entries.map((entry) => ({
    dateLabel: koreanMonthDay(toKstDateKey(entry.createdAt)),
    question: entry.question.body,
    answer: entry.body,
    photoUrl: entry.photos[0]?.url,
  }));

  const ageAt = chapter.isOpen ? today : addDays(chapter.end, -1);
  return {
    month: Number(chapter.start.slice(5, 7)),
    yearLabel: chapter.start.slice(0, 4),
    monthLabel: `${Number(chapter.start.slice(5, 7))}월`,
    childName,
    ageLabel: formatAge(birthDate, ageAt),
    items,
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

/** 앨범 안쪽은 종이 여백을 두되, 이미지와 사진 틀의 모서리는 모두 직각이다. */
export const ALBUM = {
  margin: 64, bodyBottom: 1220, answerSize: 48, answerLineHeight: 66,
  questionSize: 28, questionLineHeight: 42, dateLineHeight: 32,
  dateGap: 12, answerGap: 12, blockGap: 30,
} as const;
export const ALBUM_WIDTH = CARD_WIDTH - ALBUM.margin * 2;

export type AlbumFrame = { x: number; y: number; width: number; height: number };

/** 4개는 2×2, 5개는 위에 큰 사진 1개와 아래에 작은 사진 4개. */
export function albumFrames(count: number): AlbumFrame[] {
  const gap = 20;
  const x = ALBUM.margin;
  const y = 64;
  const width = ALBUM_WIDTH;
  const height = 1222;
  const half = (width - gap) / 2;
  if (count < 1 || count > MAX_CARD_ITEMS) return [];
  if (count === 1) return [{ x, y, width, height }];
  if (count === 2) return [0, 1].map((i) => ({ x, y: y + i * (height + gap) / 2, width, height: (height - gap) / 2 }));
  const topHeight = count === 5 ? 470 : count === 3 ? 600 : (height - gap) / 2;
  if (count === 4) return [0, 1, 2, 3].map((i) => ({
    x: x + (i % 2) * (half + gap), y: y + Math.floor(i / 2) * (topHeight + gap), width: half, height: topHeight,
  }));
  const rows = count === 5 ? 2 : 1;
  const smallHeight = (height - topHeight - gap * rows) / rows;
  return [{ x, y, width, height: topHeight }, ...Array.from({ length: count - 1 }, (_, i) => ({
    x: x + (i % 2) * (half + gap), y: y + topHeight + gap + Math.floor(i / 2) * (smallHeight + gap),
    width: half, height: smallHeight,
  }))];
}

export function albumGroups(items: MonthCardItem[]): MonthCardItem[][] {
  const groups: MonthCardItem[][] = [];
  for (let i = 0; i < items.length; i += MAX_CARD_ITEMS) groups.push(items.slice(i, i + MAX_CARD_ITEMS));
  return groups;
}

export function layoutAlbumHeader(measureFor: MeasureFor, title: string) {
  const titleSize = 46;
  const titleLines = wrapText(measureFor("title", titleSize), title, ALBUM_WIDTH, 2);
  return { titleSize, titleLines, bodyTop: 188 + titleLines.length * 60 };
}

export type AlbumStoryBlock = {
  dateLabel: string; question: string[]; answer: string[]; continued: boolean; top: number; bottom: number;
};

/** 가장 작은 글씨로 억지로 줄이거나 기록을 빼지 않고, 다음 뒷면으로 이어 쓴다. */
export function layoutAlbumStories(measureFor: MeasureFor, items: MonthCardItem[], bodyTop: number): AlbumStoryBlock[][] {
  const pages: AlbumStoryBlock[][] = [];
  let page: AlbumStoryBlock[] = [];
  let y = bodyTop;
  const nextPage = () => {
    if (page.length) pages.push(page);
    page = [];
    y = bodyTop;
  };
  // 제목 영역이 잘못됐을 때 무한히 빈 페이지를 만들지 않는다.
  if (ALBUM.bodyBottom - bodyTop < 160) throw new Error("album-body-too-small");
  for (const item of items) {
    const question = wrapParagraphs(measureFor("question", ALBUM.questionSize), item.question, ALBUM_WIDTH, Number.MAX_SAFE_INTEGER);
    const answer = wrapParagraphs(measureFor("answer", ALBUM.answerSize), item.answer, ALBUM_WIDTH, Number.MAX_SAFE_INTEGER);
    const fullHeight = ALBUM.dateLineHeight + ALBUM.dateGap + question.length * ALBUM.questionLineHeight + ALBUM.answerGap + answer.length * ALBUM.answerLineHeight;
    if (page.length && y + fullHeight > ALBUM.bodyBottom) nextPage();
    let qi = 0;
    let ai = 0;
    let continued = false;
    do {
      if (ALBUM.bodyBottom - y < 140) nextPage();
      const block: AlbumStoryBlock = { dateLabel: item.dateLabel, question: [], answer: [], continued, top: y, bottom: y };
      y += ALBUM.dateLineHeight + ALBUM.dateGap;
      while (qi < question.length && y + ALBUM.questionLineHeight <= ALBUM.bodyBottom) {
        block.question.push(question[qi++]);
        y += ALBUM.questionLineHeight;
      }
      const answerTop = y + (block.question.length ? ALBUM.answerGap : 0);
      if (qi === question.length && answerTop + ALBUM.answerLineHeight <= ALBUM.bodyBottom) {
        y = answerTop;
        while (ai < answer.length && y + ALBUM.answerLineHeight <= ALBUM.bodyBottom) {
          block.answer.push(answer[ai++]);
          y += ALBUM.answerLineHeight;
        }
      }
      block.bottom = y;
      page.push(block);
      y += ALBUM.blockGap;
      continued = true;
      if (qi < question.length || ai < answer.length) nextPage();
    } while (qi < question.length || ai < answer.length);
  }
  nextPage();
  return pages;
}
