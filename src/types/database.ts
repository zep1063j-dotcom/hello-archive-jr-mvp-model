// Supabase 스키마 타입 (supabase/migrations/20261024000000_initial_schema.sql 과 일치해야 한다).
// 원래는 `supabase gen types typescript`로 생성하지만 CLI 없이 손으로 작성했다.
// 마이그레이션이 바뀌면 이 파일도 같이 고친다 (SETUP.md의 "타입 갱신" 참고).
// 클라이언트가 쓸 수 없는 컬럼(created_at 등)은 Insert/Update에서 뺐다 — GRANT와 맞춘 것이다.

export type EmailDeliveryStatus = "processing" | "sent" | "failed" | "skipped";
export type QuestionChoiceSource = "bank" | "custom";
/** 아이의 시기 (D-038): 유년 만 0~6 / 아동 7~12 / 청소년 13~18 / 청년 19 이상 */
export type LifeStageKey = "early" | "child" | "teen" | "young";

export type Database = {
  public: {
    Tables: {
      parent_settings: {
        Row: {
          user_id: string;
          email_consent: boolean;
          consent_updated_at: string;
          /** 첫 가입 환영 온보딩을 끝낸 시각. null이면 아직 끝나지 않음 (D-040) */
          onboarding_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; email_consent?: boolean };
        Update: { email_consent?: boolean; onboarding_completed_at?: string };
        Relationships: [];
      };
      children: {
        Row: {
          id: string;
          user_id: string;
          nickname: string;
          /** YYYY-MM-DD */
          birth_date: string;
          /** Storage 버킷 photos 안의 경로 `<부모 id>/<파일명>` (D-027) */
          photo_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; nickname: string; birth_date: string };
        Update: { nickname?: string; birth_date?: string; photo_path?: string | null };
        Relationships: [];
      };
      weekly_questions: {
        Row: {
          id: string;
          /** 한국 시간 기준 월요일 YYYY-MM-DD */
          week_start: string;
          /** 같은 주에도 시기마다 질문이 하나씩 있다 (D-038) */
          stage: LifeStageKey;
          body: string;
          hint: string | null;
        };
        // 읽기 전용(시드로만 관리). 클라이언트 쓰기 권한이 없다.
        Insert: { week_start: string; stage?: LifeStageKey; body: string; hint?: string | null };
        Update: { body?: string; hint?: string | null };
        Relationships: [];
      };
      question_bank: {
        // active=false 는 예전 예시 질문이라 "바꾸기"에서 뽑지 않는다 (D-038)
        Row: { id: string; stage: LifeStageKey; active: boolean; body: string; created_at: string };
        // 읽기 전용(시드로만 관리). 클라이언트 쓰기 권한이 없다.
        Insert: { stage?: LifeStageKey; body: string };
        Update: { body?: string };
        Relationships: [];
      };
      week_question_choices: {
        Row: {
          id: string;
          user_id: string;
          weekly_question_id: string;
          source: QuestionChoiceSource;
          bank_question_id: string | null;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          weekly_question_id: string;
          source: QuestionChoiceSource;
          bank_question_id?: string | null;
          body: string;
        };
        // 주·소유자는 바꿀 수 없다. 그 주에 기록이 있으면 RLS가 수정·삭제를 막는다(0행).
        Update: { source?: QuestionChoiceSource; bank_question_id?: string | null; body?: string };
        Relationships: [];
      };
      yearly_answers: {
        Row: {
          id: string;
          user_id: string;
          child_id: string;
          /** 한국 시간 기준 달력 연도 */
          year: number;
          question_key: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          child_id: string;
          year: number;
          question_key: string;
          body: string;
        };
        // 생성 후에는 본문만 수정할 수 있다.
        Update: { body?: string };
        Relationships: [];
      };
      product_interests: {
        Row: { id: string; user_id: string; product: string; created_at: string };
        Insert: { user_id: string; product: string };
        // 수정할 컬럼이 없다(취소하면 지운다).
        Update: Record<string, never>;
        Relationships: [];
      };
      entry_photos: {
        Row: { id: string; user_id: string; entry_id: string; path: string; created_at: string };
        Insert: { user_id: string; entry_id: string; path: string };
        // 생성 후 수정할 수 없다(지우고 다시 올린다). 기록당 최대 3장(DB 트리거).
        Update: Record<string, never>;
        Relationships: [];
      };
      entries: {
        Row: {
          id: string;
          user_id: string;
          child_id: string;
          weekly_question_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          child_id: string;
          weekly_question_id: string;
          body: string;
        };
        // 생성 후에는 본문만 수정할 수 있다.
        Update: { body?: string };
        // 기록 조회에서 질문을 함께 가져오는 조인(embed)에 필요하다.
        Relationships: [
          {
            foreignKeyName: "entries_weekly_question_id_fkey";
            columns: ["weekly_question_id"];
            isOneToOne: false;
            referencedRelation: "weekly_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      email_deliveries: {
        Row: {
          id: string;
          user_id: string;
          weekly_question_id: string;
          status: EmailDeliveryStatus;
          attempts: number;
          first_attempt_at: string | null;
          last_attempt_at: string | null;
          sent_at: string | null;
          error_code: string | null;
        };
        Insert: {
          user_id: string;
          weekly_question_id: string;
          status?: EmailDeliveryStatus;
          attempts?: number;
          first_attempt_at?: string | null;
          last_attempt_at?: string | null;
          sent_at?: string | null;
          error_code?: string | null;
        };
        Update: {
          status?: EmailDeliveryStatus;
          attempts?: number;
          first_attempt_at?: string | null;
          last_attempt_at?: string | null;
          sent_at?: string | null;
          error_code?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
