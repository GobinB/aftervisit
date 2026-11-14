// The database after migrations 0001-0019, as the Supabase CLI writes it. Regenerate with:
// supabase gen types typescript --local > store/types.gen.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity: {
        Row: {
          action: string
          actor: string
          at: string
          circle_id: string
          id: string
          subject_id: string | null
          subject_type: string | null
        }
        Insert: {
          action: string
          actor: string
          at?: string
          circle_id: string
          id?: string
          subject_id?: string | null
          subject_type?: string | null
        }
        Update: {
          action?: string
          actor?: string
          at?: string
          circle_id?: string
          id?: string
          subject_id?: string | null
          subject_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_feeds: {
        Row: {
          circle_id: string
          created_at: string
          created_by: string
          token: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          created_by?: string
          token: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          created_by?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_feeds_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: true
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_caregivers: {
        Row: {
          circle_id: string
          circle_key_wrapped: string | null
          created_at: string
          key_version: number
          role: string
          user_id: string
        }
        Insert: {
          circle_id: string
          circle_key_wrapped?: string | null
          created_at?: string
          key_version?: number
          role: string
          user_id: string
        }
        Update: {
          circle_id?: string
          circle_key_wrapped?: string | null
          created_at?: string
          key_version?: number
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_caregivers_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_updates: {
        Row: {
          area: string
          changed_at: string
          circle_id: string
        }
        Insert: {
          area: string
          changed_at?: string
          circle_id: string
        }
        Update: {
          area?: string
          changed_at?: string
          circle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_updates_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          content: Json
          created_at: string
          deleted_at: string | null
          id: string
          key_version: number
          owner_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          deleted_at?: string | null
          id?: string
          key_version?: number
          owner_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          deleted_at?: string | null
          id?: string
          key_version?: number
          owner_id?: string
        }
        Relationships: []
      }
      consents: {
        Row: {
          agreed_at: string
          circle_id: string
          id: string
          text_hash: string
          type: string
          user_id: string
          version: string
        }
        Insert: {
          agreed_at?: string
          circle_id: string
          id?: string
          text_hash: string
          type: string
          user_id: string
          version: string
        }
        Update: {
          agreed_at?: string
          circle_id?: string
          id?: string
          text_hash?: string
          type?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          circle_id: string
          created_at: string
          created_by: string | null
          end_time: string | null
          event_date: string
          going_caregiver: boolean
          going_member_id: string | null
          id: string
          location: string | null
          needs_volunteer: boolean
          notes: string | null
          repeat: string
          repeat_until: string | null
          source: string
          start_time: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          circle_id: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          event_date: string
          going_caregiver?: boolean
          going_member_id?: string | null
          id?: string
          location?: string | null
          needs_volunteer?: boolean
          notes?: string | null
          repeat?: string
          repeat_until?: string | null
          source?: string
          start_time?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          circle_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          event_date?: string
          going_caregiver?: boolean
          going_member_id?: string | null
          id?: string
          location?: string | null
          needs_volunteer?: boolean
          notes?: string | null
          repeat?: string
          repeat_until?: string | null
          source?: string
          start_time?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_going_member_id_fkey"
            columns: ["going_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          context: string
          created_at: string
          easier: string | null
          id: number
          still_need: string | null
          who_else: string | null
        }
        Insert: {
          context: string
          created_at?: string
          easier?: string | null
          id?: never
          still_need?: string | null
          who_else?: string | null
        }
        Update: {
          context?: string
          created_at?: string
          easier?: string | null
          id?: never
          still_need?: string | null
          who_else?: string | null
        }
        Relationships: []
      }
      handoff_events: {
        Row: {
          actor: string
          at: string
          detail: Json
          handoff_token: string
          id: number
          kind: string
          recipient_id: string | null
          via: string
        }
        Insert: {
          actor: string
          at?: string
          detail?: Json
          handoff_token: string
          id?: never
          kind: string
          recipient_id?: string | null
          via: string
        }
        Update: {
          actor?: string
          at?: string
          detail?: Json
          handoff_token?: string
          id?: never
          kind?: string
          recipient_id?: string | null
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "handoff_events_handoff_token_fkey"
            columns: ["handoff_token"]
            isOneToOne: false
            referencedRelation: "handoffs"
            referencedColumns: ["token"]
          },
          {
            foreignKeyName: "handoff_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "handoff_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      handoff_recipients: {
        Row: {
          acked_at: string | null
          created_at: string
          first_opened_at: string | null
          handoff_token: string
          id: string
          invite_hash: string
          last_opened_at: string | null
          locked_until: string | null
          name: string
          pin_failures: number
          pin_lock_count: number
          revoked_at: string | null
          role: string
          sections: Json
          tasks_scope: string
        }
        Insert: {
          acked_at?: string | null
          created_at?: string
          first_opened_at?: string | null
          handoff_token: string
          id?: string
          invite_hash: string
          last_opened_at?: string | null
          locked_until?: string | null
          name: string
          pin_failures?: number
          pin_lock_count?: number
          revoked_at?: string | null
          role: string
          sections?: Json
          tasks_scope?: string
        }
        Update: {
          acked_at?: string | null
          created_at?: string
          first_opened_at?: string | null
          handoff_token?: string
          id?: string
          invite_hash?: string
          last_opened_at?: string | null
          locked_until?: string | null
          name?: string
          pin_failures?: number
          pin_lock_count?: number
          revoked_at?: string | null
          role?: string
          sections?: Json
          tasks_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "handoff_recipients_handoff_token_fkey"
            columns: ["handoff_token"]
            isOneToOne: false
            referencedRelation: "handoffs"
            referencedColumns: ["token"]
          },
        ]
      }
      handoff_task_status: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          handoff_token: string
          note: string | null
          status: string
          task_id: string
          updated_at: string | null
          updated_by_id: string | null
          updated_by_name: string | null
          updated_via: string | null
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          handoff_token: string
          note?: string | null
          status?: string
          task_id: string
          updated_at?: string | null
          updated_by_id?: string | null
          updated_by_name?: string | null
          updated_via?: string | null
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          handoff_token?: string
          note?: string | null
          status?: string
          task_id?: string
          updated_at?: string | null
          updated_by_id?: string | null
          updated_by_name?: string | null
          updated_via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "handoff_task_status_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "handoff_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoff_task_status_handoff_token_fkey"
            columns: ["handoff_token"]
            isOneToOne: false
            referencedRelation: "handoffs"
            referencedColumns: ["token"]
          },
          {
            foreignKeyName: "handoff_task_status_updated_by_id_fkey"
            columns: ["updated_by_id"]
            isOneToOne: false
            referencedRelation: "handoff_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      handoff_tombstones: {
        Row: {
          created_at: string
          reason: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          reason: string
          token_hash: string
        }
        Update: {
          created_at?: string
          reason?: string
          token_hash?: string
        }
        Relationships: []
      }
      handoffs: {
        Row: {
          access_mode: string
          acks: Json
          created_at: string
          created_by: string | null
          expires_at: string
          locked_until: string | null
          manage_key_hash: string
          original_path: string | null
          payload: Json
          pin_failures: number
          pin_hash: string | null
          pin_lock_count: number
          recipients: Json
          source_text: string | null
          token: string
        }
        Insert: {
          access_mode?: string
          acks?: Json
          created_at?: string
          created_by?: string | null
          expires_at: string
          locked_until?: string | null
          manage_key_hash: string
          original_path?: string | null
          payload: Json
          pin_failures?: number
          pin_hash?: string | null
          pin_lock_count?: number
          recipients?: Json
          source_text?: string | null
          token: string
        }
        Update: {
          access_mode?: string
          acks?: Json
          created_at?: string
          created_by?: string | null
          expires_at?: string
          locked_until?: string | null
          manage_key_hash?: string
          original_path?: string | null
          payload?: Json
          pin_failures?: number
          pin_hash?: string | null
          pin_lock_count?: number
          recipients?: Json
          source_text?: string | null
          token?: string
        }
        Relationships: []
      }
      medication_changes: {
        Row: {
          actor: string
          at: string
          change: string
          circle_id: string
          id: string
          medication_id: string
          source: string
          summary: string
        }
        Insert: {
          actor: string
          at?: string
          change: string
          circle_id: string
          id?: string
          medication_id: string
          source?: string
          summary: string
        }
        Update: {
          actor?: string
          at?: string
          change?: string
          circle_id?: string
          id?: string
          medication_id?: string
          source?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_changes_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_changes_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          amount: string | null
          circle_id: string
          created_at: string
          dose: string | null
          every: number | null
          form: string | null
          id: string
          instructions: string | null
          last_refill: string | null
          name: string
          prescriber: string | null
          reason: string | null
          refills_left: number | null
          schedule: string
          source: string
          start_date: string | null
          status: string
          stop_date: string | null
          times: string[]
          updated_at: string
          weekdays: number[] | null
        }
        Insert: {
          amount?: string | null
          circle_id: string
          created_at?: string
          dose?: string | null
          every?: number | null
          form?: string | null
          id?: string
          instructions?: string | null
          last_refill?: string | null
          name: string
          prescriber?: string | null
          reason?: string | null
          refills_left?: number | null
          schedule?: string
          source?: string
          start_date?: string | null
          status?: string
          stop_date?: string | null
          times?: string[]
          updated_at?: string
          weekdays?: number[] | null
        }
        Update: {
          amount?: string | null
          circle_id?: string
          created_at?: string
          dose?: string | null
          every?: number | null
          form?: string | null
          id?: string
          instructions?: string | null
          last_refill?: string | null
          name?: string
          prescriber?: string | null
          reason?: string | null
          refills_left?: number | null
          schedule?: string
          source?: string
          start_date?: string | null
          status?: string
          stop_date?: string | null
          times?: string[]
          updated_at?: string
          weekdays?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "medications_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          circle_id: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          last_seen_at: string | null
          last_told_at: string | null
          link_issued_at: string
          link_version: number
          lock_count: number
          locked_until: string | null
          name: string
          pin_failures: number
          pin_hash: string | null
          revoked_at: string | null
          role: string
          token_hash: string
          user_id: string | null
          visibility: Json
        }
        Insert: {
          circle_id: string
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          last_seen_at?: string | null
          last_told_at?: string | null
          link_issued_at?: string
          link_version?: number
          lock_count?: number
          locked_until?: string | null
          name: string
          pin_failures?: number
          pin_hash?: string | null
          revoked_at?: string | null
          role: string
          token_hash: string
          user_id?: string | null
          visibility?: Json
        }
        Update: {
          circle_id?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          last_seen_at?: string | null
          last_told_at?: string | null
          link_issued_at?: string
          link_version?: number
          lock_count?: number
          locked_until?: string | null
          name?: string
          pin_failures?: number
          pin_hash?: string | null
          revoked_at?: string | null
          role?: string
          token_hash?: string
          user_id?: string | null
          visibility?: Json
        }
        Relationships: [
          {
            foreignKeyName: "members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          ip_hash: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          ip_hash: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          ip_hash?: string
          window_start?: string
        }
        Relationships: []
      }
      todos: {
        Row: {
          assigned_to_caregiver: boolean
          assignee_member_id: string | null
          circle_id: string
          created_at: string
          done_at: string | null
          done_by: string | null
          due_date: string | null
          id: string
          note: string | null
          source: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to_caregiver?: boolean
          assignee_member_id?: string | null
          circle_id: string
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          due_date?: string | null
          id?: string
          note?: string | null
          source?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to_caregiver?: boolean
          assignee_member_id?: string | null
          circle_id?: string
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          due_date?: string | null
          id?: string
          note?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_assignee_member_id_fkey"
            columns: ["assignee_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_documents: {
        Row: {
          circle_id: string
          clinic: string | null
          created_at: string
          created_by: string
          file_key_iv: string | null
          file_key_wrapped: string | null
          id: string
          key_version: number | null
          kind: string
          page_count: number
          paths: string[]
          visit_date: string | null
        }
        Insert: {
          circle_id: string
          clinic?: string | null
          created_at?: string
          created_by?: string
          file_key_iv?: string | null
          file_key_wrapped?: string | null
          id?: string
          key_version?: number | null
          kind: string
          page_count?: number
          paths?: string[]
          visit_date?: string | null
        }
        Update: {
          circle_id?: string
          clinic?: string | null
          created_at?: string
          created_by?: string
          file_key_iv?: string | null
          file_key_wrapped?: string | null
          id?: string
          key_version?: number | null
          kind?: string
          page_count?: number
          paths?: string[]
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_documents_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ack_recipient: { Args: { p_recipient: string }; Returns: boolean }
      add_ack: { Args: { p_name: string; p_token: string }; Returns: number }
      check_rate_limit: {
        Args: { p_bucket: string; p_ip_hash: string; p_limit: number }
        Returns: boolean
      }
      circle_owner_id: { Args: { p_circle: string }; Returns: string }
      create_circle: {
        Args: { p_consents: Json; p_content: Json }
        Returns: string
      }
      delete_circle: { Args: { p_circle: string }; Returns: undefined }
      is_circle_caregiver: { Args: { p_circle: string }; Returns: boolean }
      is_circle_owner: { Args: { p_circle: string }; Returns: boolean }
      purge_deleted_circles: { Args: { p_days?: number }; Returns: number }
      try_pin: {
        Args: {
          p_candidate: string
          p_hard_after: number
          p_lock_minutes: number
          p_max: number
          p_recipient: string
          p_token: string
        }
        Returns: {
          attempts_left: number
          locked_until: string
          result: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

