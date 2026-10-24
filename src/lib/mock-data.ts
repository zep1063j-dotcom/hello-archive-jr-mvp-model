// SESSION 01 전용 목 데이터. SESSION 02~05에서 실제 DB 조회로 교체한다.
// "오늘"을 고정해 렌더링이 항상 같은 결과를 내도록 한다 (Cache Components 사전 렌더링과 호환).
import { filterByPeriod } from "@/lib/entries";
import type {
  ChapterPeriod,
  Child,
  Entry,
  WeeklyQuestion,
} from "@/types/archive";

export const MOCK_TODAY = "2026-10-24";

/**
 * 화면 상태를 바꿔 보는 목 시나리오 (?mock=...).
 * - (기본) 아이 기록이 여러 개 있고 이번 주는 아직 안 씀
 * - written: 이번 주 기록도 있음
 * - empty: 기록이 하나도 없음
 * - error: 저장/조회 실패 상태
 */
export type MockScenario = "default" | "written" | "empty" | "error";

export function parseScenario(value: string | string[] | undefined): MockScenario {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "written" || raw === "empty" || raw === "error" ? raw : "default";
}

export const mockChild: Child = {
  id: "child-1",
  nickname: "콩이",
  birthDate: "2022-05-14",
};

export const thisWeekQuestion: WeeklyQuestion = {
  id: "q-2026-10-19",
  weekStart: "2026-10-19",
  body: "요즘 아이가 자주 하는 말이나 말투는 무엇인가요?",
  hint: "오늘 들은 한마디도 좋아요. 그때 아이의 표정이나 상황을 함께 적어 두면 나중에 더 생생해요.",
};

function makeEntry(
  weekStart: string,
  createdAt: string,
  question: string,
  body: string,
): Entry {
  return {
    id: `entry-${weekStart}`,
    question: { id: `q-${weekStart}`, weekStart, body: question },
    body,
    createdAt,
    updatedAt: createdAt,
  };
}

const thisWeekEntry: Entry = makeEntry(
  thisWeekQuestion.weekStart,
  "2026-10-22T21:40:00+09:00",
  thisWeekQuestion.body,
  "요즘은 뭐든 \"내가 할래!\"라고 말한다. 신발도 혼자 신겠다고 현관에서 십 분을 버텼다. 늦을 것 같아 도와주려다 참았더니, 끝내 오른쪽 왼쪽이 바뀐 채로 신고는 \"됐다!\" 하고 웃었다.",
);

const pastEntries: Entry[] = [
  makeEntry(
    "2026-10-12",
    "2026-10-15T22:05:00+09:00",
    "아이가 최근에 가장 크게 웃은 순간은 언제인가요?",
    "목욕 중에 거품을 코에 올리고는 \"할아버지다!\" 하면서 배를 잡고 웃었다. 나도 같이 웃다가 물을 한 바가지 맞았다.",
  ),
  makeEntry(
    "2026-10-05",
    "2026-10-08T20:30:00+09:00",
    "아이가 요즘 푹 빠져 있는 놀이는 무엇인가요?",
    "블록으로 \"병원\"을 만들어 곰 인형을 환자로 눕혔다. 청진기 대신 숟가락을 대고 \"조금 아파요~\" 하며 진지하게 진찰한다.",
  ),
  makeEntry(
    "2026-09-28",
    "2026-09-30T21:10:00+09:00",
    "이번 주에 아이가 처음 해본 일이 있나요?",
    "처음으로 혼자 계단 세 칸을 뛰어내렸다. 내려와서 나를 쳐다보며 \"봤어? 봤어?\" 하고 세 번 물었다.",
  ),
  makeEntry(
    "2026-09-14",
    "2026-09-17T22:20:00+09:00",
    "아이에게서 배운 것이 있다면 무엇인가요?",
    "비 오는 날 우산 대신 장화만 신고 나가자고 졸랐다. 물웅덩이를 그냥 지나치지 않는 마음이 부러웠다.",
  ),
  makeEntry(
    "2026-08-31",
    "2026-09-02T20:45:00+09:00",
    "아이가 잠들기 전에 하는 말이나 행동이 있나요?",
    "불을 끄면 꼭 \"엄마 손 여기\" 하며 내 손을 자기 볼에 갖다 댄다. 그러고는 일 분도 안 돼 잠든다.",
  ),
  makeEntry(
    "2026-08-10",
    "2026-08-13T21:00:00+09:00",
    "아이가 요즘 궁금해하는 것은 무엇인가요?",
    "\"달은 왜 나만 따라와?\" 하고 차 안에서 물었다. 제대로 설명하지 못해 \"달이 너를 좋아하나 봐\"라고 답했다.",
  ),
  makeEntry(
    "2026-07-13",
    "2026-07-15T22:30:00+09:00",
    "여름 중 아이와 함께한 가장 좋았던 시간은 언제인가요?",
    "물놀이장에서 처음으로 얼굴을 물에 담갔다. 눈을 꼭 감고 하나, 둘, 셋을 세더니 올라와서 \"나 물고기야!\"라고 소리쳤다.",
  ),
  makeEntry(
    "2026-05-18",
    "2026-05-21T21:15:00+09:00",
    "아이가 만 네 살이 되고 달라진 점은 무엇인가요?",
    "생일이 지나고 \"나는 이제 네 살이야\"를 하루에 열 번쯤 말한다. 손가락 네 개를 펴는 모양이 조금 어색해서 더 귀엽다.",
  ),
];

/** 시나리오별 기록 목록 (최신순) */
export function getMockEntries(scenario: MockScenario): Entry[] {
  if (scenario === "empty") return [];
  return scenario === "written" ? [thisWeekEntry, ...pastEntries] : pastEntries;
}

export function getMockThisWeekEntry(scenario: MockScenario): Entry | null {
  return scenario === "written" ? thisWeekEntry : null;
}

/** 상세 화면용. 모든 시나리오의 기록 중에서 찾는다. */
export function findMockEntry(entryId: string): Entry | undefined {
  return [thisWeekEntry, ...pastEntries].find((entry) => entry.id === entryId);
}

export function allMockEntryIds(): string[] {
  return [thisWeekEntry, ...pastEntries].map((entry) => entry.id);
}

/** 기간 묶음 목 필터. 경계 정의는 `lib/entries.ts` (실제 확정은 SESSION 06). */
export function getMockChapterEntries(period: ChapterPeriod): Entry[] {
  return filterByPeriod([thisWeekEntry, ...pastEntries], period, MOCK_TODAY);
}

export function isChapterPeriod(value: string): value is ChapterPeriod {
  return value === "1m" || value === "3m" || value === "1y";
}

export const CHAPTER_TITLES: Record<ChapterPeriod, { name: string; summary: string }> = {
  "1m": { name: "1개월 미니챕터", summary: "최근 한 달의 기록" },
  "3m": { name: "3개월 이야기집", summary: "최근 석 달의 기록" },
  "1y": { name: "1년 기록집", summary: "최근 1년의 기록" },
};
