export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Public schema after migrations 0001-0004. Regenerate with:
// supabase gen types typescript --local > store/types.gen.ts
export type Database = {
  public: {
    Tables: {
      activity: {
        Row: {
          id: string
          circle_id: string
          actor: string
          action: string
          subject_type: string | null
          subject_id: string | null
          at: string
        }
        Insert: {
          id?: string
          circle_id: string
          actor: string
          action: string
          subject_type?: string | null
          subject_id?: string | null
          at?: string
        }
        Update: {
          id?: string | null
          circle_id?: string | null
          actor?: string | null
          action?: string | null
          subject_type?: string | null
          subject_id?: string | null
          at?: string | null
        }
        Relationships: []
      }
      circle_caregivers: {
        Row: {
          circle_id: string
          user_id: string
          role: string
          circle_key_wrapped: string | null
          key_version: number
          created_at: string
        }
        Insert: {
          circle_id: string
          user_id: string
          role: string
          circle_key_wrapped?: string | null
          key_version?: number
          created_at?: string
        }
        Update: {
          circle_id?: string | null
          user_id?: string | null
          role?: string | null
          circle_key_wrapped?: string | null
          key_version?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      circles: {
        Row: {
          id: string
          owner_id: string
          created_at: string
          deleted_at: string | null
          key_version: number
          content: Json
        }
        Insert: {
          id?: string
          owner_id: string
          created_at?: string
          deleted_at?: string | null
          key_version?: number
          content: Json
        }
        Update: {
          id?: string | null
          owner_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          key_version?: number | null
          content?: Json | null
        }
        Relationships: []
      }
      consents: {
        Row: {
          id: string
          circle_id: string
          user_id: string
          type: string
          version: string
          text_hash: string
          agreed_at: string
        }
        Insert: {
          id?: string
          circle_id: string
          user_id: string
          type: string
          version: string
          text_hash: string
          agreed_at?: string
        }
        Update: {
          id?: string | null
          circle_id?: string | null
          user_id?: string | null
          type?: string | null
          version?: string | null
          text_hash?: string | null
          agreed_at?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          id: number
          created_at: string
          context: string
          easier: string | null
          still_need: string | null
          who_else: string | null
        }
        Insert: {
          id: number
          created_at?: string
          context: string
          easier?: string | null
          still_need?: string | null
          who_else?: string | null
        }
        Update: {
          id?: number | null
          created_at?: string | null
          context?: string | null
          easier?: string | null
          still_need?: string | null
          who_else?: string | null
        }
        Relationships: []
      }
      handoff_events: {
        Row: {
          id: number
          handoff_token: string
          recipient_id: string | null
          actor: string
          via: string
          kind: string
          detail: Json
          at: string
        }
        Insert: {
          id: number
          handoff_token: string
          recipient_id?: string | null
          actor: string
          via: string
          kind: string
          detail?: Json
          at?: string
        }
        Update: {
          id?: number | null
          handoff_token?: string | null
          recipient_id?: string | null
          actor?: string | null
          via?: string | null
          kind?: string | null
          detail?: Json | null
          at?: string | null
        }
        Relationships: []
      }
      handoff_recipients: {
        Row: {
          id: string
          handoff_token: string
          name: string
          role: string
          invite_hash: string
          sections: Json
          tasks_scope: string
          created_at: string
          revoked_at: string | null
          first_opened_at: string | null
          last_opened_at: string | null
          acked_at: string | null
          pin_failures: number
          locked_until: string | null
          pin_lock_count: number
        }
        Insert: {
          id?: string
          handoff_token: string
          name: string
          role: string
          invite_hash: string
          sections?: Json
          tasks_scope?: string
          created_at?: string
          revoked_at?: string | null
          first_opened_at?: string | null
          last_opened_at?: string | null
          acked_at?: string | null
          pin_failures?: number
          locked_until?: string | null
          pin_lock_count?: number
        }
        Update: {
          id?: string | null
          handoff_token?: string | null
          name?: string | null
          role?: string | null
          invite_hash?: string | null
          sections?: Json | null
          tasks_scope?: string | null
          created_at?: string | null
          revoked_at?: string | null
          first_opened_at?: string | null
          last_opened_at?: string | null
          acked_at?: string | null
          pin_failures?: number | null
          locked_until?: string | null
          pin_lock_count?: number | null
        }
        Relationships: []
      }
      handoff_task_status: {
        Row: {
          handoff_token: string
          task_id: string
          assignee_id: string | null
          status: string
          note: string | null
          updated_at: string | null
          updated_by_id: string | null
          updated_by_name: string | null
          updated_via: string | null
          completed_at: string | null
        }
        Insert: {
          handoff_token: string
          task_id: string
          assignee_id?: string | null
          status?: string
          note?: string | null
          updated_at?: string | null
          updated_by_id?: string | null
          updated_by_name?: string | null
          updated_via?: string | null
          completed_at?: string | null
        }
        Update: {
          handoff_token?: string | null
          task_id?: string | null
          assignee_id?: string | null
          status?: string | null
          note?: string | null
          updated_at?: string | null
          updated_by_id?: string | null
          updated_by_name?: string | null
          updated_via?: string | null
          completed_at?: string | null
        }
        Relationships: []
      }
      handoff_tombstones: {
        Row: {
          token_hash: string
          reason: string
          created_at: string
        }
        Insert: {
          token_hash: string
          reason: string
          created_at?: string
        }
        Update: {
          token_hash?: string | null
          reason?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      handoffs: {
        Row: {
          token: string
          manage_key_hash: string
          pin_hash: string | null
          pin_failures: number
          locked_until: string | null
          payload: Json
          source_text: string | null
          original_path: string | null
          created_by: string | null
          recipients: Json
          acks: Json
          created_at: string
          expires_at: string
          access_mode: string
          pin_lock_count: number
        }
        Insert: {
          token: string
          manage_key_hash: string
          pin_hash?: string | null
          pin_failures?: number
          locked_until?: string | null
          payload: Json
          source_text?: string | null
          original_path?: string | null
          created_by?: string | null
          recipients?: Json
          acks?: Json
          created_at?: string
          expires_at: string
          access_mode?: string
          pin_lock_count?: number
        }
        Update: {
          token?: string | null
          manage_key_hash?: string | null
          pin_hash?: string | null
          pin_failures?: number | null
          locked_until?: string | null
          payload?: Json | null
          source_text?: string | null
          original_path?: string | null
          created_by?: string | null
          recipients?: Json | null
          acks?: Json | null
          created_at?: string | null
          expires_at?: string | null
          access_mode?: string | null
          pin_lock_count?: number | null
        }
        Relationships: []
      }
      members: {
        Row: {
          id: string
          circle_id: string
          user_id: string | null
          name: string
          role: string
          email: string | null
          token_hash: string
          pin_hash: string | null
          pin_failures: number
          locked_until: string | null
          lock_count: number
          visibility: Json
          expires_at: string
          revoked_at: string | null
          last_seen_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          circle_id: string
          user_id?: string | null
          name: string
          role: string
          email?: string | null
          token_hash: string
          pin_hash?: string | null
          pin_failures?: number
          locked_until?: string | null
          lock_count?: number
          visibility?: Json
          expires_at: string
          revoked_at?: string | null
          last_seen_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string | null
          circle_id?: string | null
          user_id?: string | null
          name?: string | null
          role?: string | null
          email?: string | null
          token_hash?: string | null
          pin_hash?: string | null
          pin_failures?: number | null
          locked_until?: string | null
          lock_count?: number | null
          visibility?: Json | null
          expires_at?: string | null
          revoked_at?: string | null
          last_seen_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          ip_hash: string
          bucket: string
          window_start: string
          count: number
        }
        Insert: {
          ip_hash: string
          bucket: string
          window_start: string
          count?: number
        }
        Update: {
          ip_hash?: string | null
          bucket?: string | null
          window_start?: string | null
          count?: number | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      try_pin: {
        Args: {
          p_token: string
          p_recipient: string | null
          p_candidate: string | null
          p_max: number
          p_lock_minutes: number
          p_hard_after: number
        }
        Returns: { result: string; locked_until: string | null; attempts_left: number | null }[]
      }
      check_rate_limit: { Args: { p_ip_hash: string; p_bucket: string; p_limit: number }; Returns: boolean }
      add_ack: { Args: { p_token: string; p_name: string }; Returns: number | null }
      ack_recipient: { Args: { p_recipient: string }; Returns: boolean }
      is_circle_caregiver: { Args: { p_circle: string }; Returns: boolean }
      is_circle_owner: { Args: { p_circle: string }; Returns: boolean }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
