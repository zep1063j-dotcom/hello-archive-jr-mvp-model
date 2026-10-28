import type { Season } from "./month-card.ts";

// 월별 이야기 카드의 계절 색 (D-048). 아카이브 카드 목록의 썸네일, 카드 화면의 이야기·사진 면, 저장·공유 이미지가 모두 이 한 곳의 색을 쓴다.
// 계절은 카드 대상 달(챕터 시작월)로 정한다 — 오늘 날짜나 카드를 만든 날이 아니다. 그래서 과거 카드를 지금 다시 열어도 그 달의 색이다.
// 계절 색은 카드에만 쓴다. 사이트 전체 배경·메뉴 색은 바꾸지 않는다.
// 색을 바꾸려면 아래 SEASON_COLORS의 세 값만 고친다(바탕 / 글자 / 포인트). 나머지(보조 글자·구분선·사진 면 바탕)는 이 값에서 계산한다.
export type SeasonColors = {
  /** 이야기 면 바탕 */
  background: string;
  /** 본문 글자 */
  ink: string;
  /** 점·짧은 선·구분 표시에만 쓰는 포인트 */
  accent: string;
};

export const SEASON_COLORS: Record<Season, SeasonColors> = {
  spring: { background: "#F5DFE5", ink: "#572C43", accent: "#46745A" },
  summer: { background: "#DCECF5", ink: "#183E70", accent: "#D65A28" },
  autumn: { background: "#F1DDC5", ink: "#593723", accent: "#A64232" },
  winter: { background: "#E5E5F2", ink: "#353553", accent: "#465BB0" },
};

export type CardTheme = SeasonColors & {
  /** 사진 면 바탕: 같은 계열의 옅은 색 */
  photoBackground: string;
  /** 질문처럼 차분하게 보일 글자(본문색보다 옅다) */
  soft: string;
  /** 날짜·브랜드처럼 가장 작은 글자 */
  mute: string;
  /** 항목 사이 구분선 */
  line: string;
};

function parseHex(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** `from`에 `to`를 `ratio`(0~1)만큼 섞은 색 */
export function mixColors(from: string, to: string, ratio: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const channels = a.map((channel, index) => Math.round(channel + (b[index] - channel) * ratio));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 대비 비율 (글자 4.5 이상이 읽기 쉽다) */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function buildTheme({ background, ink, accent }: SeasonColors): CardTheme {
  return {
    background,
    ink,
    accent,
    photoBackground: mixColors(background, "#ffffff", 0.6),
    soft: mixColors(ink, background, 0.12),
    mute: mixColors(ink, background, 0.2),
    line: mixColors(ink, background, 0.78),
  };
}

export const CARD_THEMES: Record<Season, CardTheme> = {
  spring: buildTheme(SEASON_COLORS.spring),
  summer: buildTheme(SEASON_COLORS.summer),
  autumn: buildTheme(SEASON_COLORS.autumn),
  winter: buildTheme(SEASON_COLORS.winter),
};
