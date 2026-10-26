// 화면 계약용 타입. SESSION 02에서 DB 타입과 연결할 때 이 모양을 기준으로 맞춘다.
export type Child = {
  id: string;
  nickname: string;
  /** YYYY-MM-DD */
  birthDate: string;
  /** 등록 시각 ISO 8601 (timestamptz). 지난 질문을 쓸 수 있는 시작 주를 정하는 데 쓴다 */
  createdAt: string;
  /** 프로필 사진의 Storage 경로. 화면에는 서버가 만든 서명 URL로 보여 준다 (D-027) */
  photoPath: string | null;
};

export type WeeklyQuestion = {
  id: string;
  /** 한국 시간 기준 월요일 YYYY-MM-DD */
  weekStart: string;
  body: string;
  hint?: string;
  /** 부모가 이 주의 질문을 바꿨을 때만 있다: 은행에서 고른 질문 / 직접 쓴 질문. 없으면 모두에게 같은 기본 질문 (D-025) */
  source?: "bank" | "custom";
};

/** 기록 사진. `url`은 서버가 만든 짧게 유효한 서명 URL이다 (D-027) */
export type EntryPhoto = { id: string; url: string };

export type Entry = {
  id: string;
  question: WeeklyQuestion;
  body: string;
  photos: EntryPhoto[];
  /** ISO 8601 (timestamptz) */
  createdAt: string;
  updatedAt: string;
};

export type ChapterPeriod = "1m" | "3m" | "1y";
