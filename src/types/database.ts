// Supabase 스키마 타입 (supabase/migrations/20261024000000_initial_schema.sql 과 일치해야 한다).
// 원래는 `supabase gen types typescript`로 생성하지만 CLI 없이 손으로 작성했다.
// 마이그레이션이 바뀌면 이 파일도 같이 고친다 (SETUP.md의 "타입 갱신" 참고).
// 클라이언트가 쓸 수 없는 컬럼(created_at 등)은 Insert/Update에서 뺐다 — GRANT와 맞춘 것이다.

export type EmailDeliveryStatus = "processing" | "sent" | "failed" | "skipped";

export type Database = {
  public: {
    Tables: {
      parent_settings: {
        Row: {
          user_id: string;
          email_consent: boolean;
          consent_updated_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; email_consent?: boolean };
        Update: { email_consent?: boolean };
        Relationships: [];
      };
      children: {
        Row: {
          id: string;
          user_id: string;
          nickname: string;
          /** YYYY-MM-DD */
          birth_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; nickname: string; birth_date: string };
        Update: { nickname?: string; birth_date?: string };
        Relationships: [];
      };
      weekly_questions: {
        Row: {
          id: string;
          /** 한국 시간 기준 월요일 YYYY-MM-DD */
          week_start: string;
          body: string;
          hint: string | null;
        };
        // 읽기 전용(시드로만 관리). 클라이언트 쓰기 권한이 없다.
        Insert: { week_start: string; body: string; hint?: string | null };
        Update: { body?: string; hint?: string | null };
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
        Relationships: [];
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
