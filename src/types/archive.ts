// 화면 계약용 타입. SESSION 02에서 DB 타입과 연결할 때 이 모양을 기준으로 맞춘다.
export type Child = {
  id: string;
  nickname: string;
  /** YYYY-MM-DD */
  birthDate: string;
};

export type WeeklyQuestion = {
  id: string;
  /** 한국 시간 기준 월요일 YYYY-MM-DD */
  weekStart: string;
  body: string;
  hint?: string;
};

export type Entry = {
  id: string;
  question: WeeklyQuestion;
  body: string;
  /** ISO 8601 (timestamptz) */
  createdAt: string;
  updatedAt: string;
};

export type ChapterPeriod = "1m" | "3m" | "1y";
