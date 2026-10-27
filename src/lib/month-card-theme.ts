import type { Season } from "./month-card.ts";

// 1개월 이야기 카드의 계절별 색 (D-033). 캔버스 카드(components/month-card.tsx)와 아카이브 상단 카드 목록이 같은 색을 쓰도록 한 곳에 둔다.
// 카드 색은 달의 계절을 따른다(3~5월 연한 버터, 6~8월 연한 하늘, 9~11월 연한 라벤더, 12~2월 짙은 갈색).
// 색을 바꾸려면 아래 값만 고친다. `polaroidInk`는 뒷면 폴라로이드(밝은 종이) 위 글자색이다.
export type CardTheme = {
  front: string;
  back: string;
  polaroid: string;
  polaroidInk: string;
  ink: string;
  soft: string;
  mute: string;
  accent: string;
  line: string;
};

export const CARD_THEMES: Record<Season, CardTheme> = {
  spring: {
    front: "#fbf0cf",
    back: "#f7e3b0",
    polaroid: "#fffdf5",
    polaroidInk: "#1a1a1a",
    ink: "#1a1a1a",
    soft: "#5c5440",
    mute: "#8a8062",
    accent: "#d92f3e",
    line: "#e3d6a8",
  },
  summer: {
    front: "#e6eef6",
    back: "#d3e2f0",
    polaroid: "#fbfdff",
    polaroidInk: "#14202c",
    ink: "#14202c",
    soft: "#475a6b",
    mute: "#76889a",
    accent: "#d92f3e",
    line: "#c3d3e2",
  },
  autumn: {
    front: "#eeeaf6",
    back: "#ddd5ee",
    polaroid: "#fdfcff",
    polaroidInk: "#1d1a2b",
    ink: "#1d1a2b",
    soft: "#554f6b",
    mute: "#837d99",
    accent: "#d92f3e",
    line: "#cfc7e2",
  },
  winter: {
    front: "#3b2a21",
    back: "#4d382c",
    polaroid: "#f7f0e4",
    polaroidInk: "#2a1d16",
    ink: "#f7efe3",
    soft: "#d9c8b4",
    mute: "#a89580",
    accent: "#ff8a80",
    line: "#5a443a",
  },
};
