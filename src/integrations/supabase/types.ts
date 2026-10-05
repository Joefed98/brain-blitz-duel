export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      duel_players: {
        Row: {
          created_at: string
          display_name: string
          duel_id: string
          id: string
          intro_ready_round: number
          joined_at: string
          last_reaction_at: string | null
          last_seen_at: string
          muted_by_host: boolean
          player_slot: number
          ready_round: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          duel_id: string
          id?: string
          intro_ready_round?: number
          joined_at?: string
          last_reaction_at?: string | null
          last_seen_at?: string
          muted_by_host?: boolean
          player_slot: number
          ready_round?: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          duel_id?: string
          id?: string
          intro_ready_round?: number
          joined_at?: string
          last_reaction_at?: string | null
          last_seen_at?: string
          muted_by_host?: boolean
          player_slot?: number
          ready_round?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_players_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_secrets: {
        Row: {
          created_at: string
          duel_id: string
          puzzles_private: Json
        }
        Insert: {
          created_at?: string
          duel_id: string
          puzzles_private: Json
        }
        Update: {
          created_at?: string
          duel_id?: string
          puzzles_private?: Json
        }
        Relationships: [
          {
            foreignKeyName: "duel_secrets_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: true
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
        ]
      }
      duels: {
        Row: {
          add_arcade: boolean
          add_maths: boolean
          created_at: string
          current_round: number
          disbanded_at: string | null
          host_user_id: string | null
          id: string
          max_players: number
          next_duel_id: string | null
          no_maths: boolean
          phase: string
          phase_started_at: string | null
          puzzles_public: Json
          room_code: string
          round_count: number
          round_order: Json
          round_started_at: string | null
          selected_categories: Json
          status: string
          tournament_history: Json
        }
        Insert: {
          add_arcade?: boolean
          add_maths?: boolean
          created_at?: string
          current_round?: number
          disbanded_at?: string | null
          host_user_id?: string | null
          id?: string
          max_players?: number
          next_duel_id?: string | null
          no_maths?: boolean
          phase?: string
          phase_started_at?: string | null
          puzzles_public?: Json
          room_code: string
          round_count?: number
          round_order: Json
          round_started_at?: string | null
          selected_categories?: Json
          status?: string
          tournament_history?: Json
        }
        Update: {
          add_arcade?: boolean
          add_maths?: boolean
          created_at?: string
          current_round?: number
          disbanded_at?: string | null
          host_user_id?: string | null
          id?: string
          max_players?: number
          next_duel_id?: string | null
          no_maths?: boolean
          phase?: string
          phase_started_at?: string | null
          puzzles_public?: Json
          room_code?: string
          round_count?: number
          round_order?: Json
          round_started_at?: string | null
          selected_categories?: Json
          status?: string
          tournament_history?: Json
        }
        Relationships: []
      }
      intro_demos: {
        Row: {
          example_id: string | null
          game_type: string
          input_log: Json
          length_ticks: number
          puzzle: Json
          recorded_at: string
          seed: number
          start_tick: number
        }
        Insert: {
          example_id?: string | null
          game_type: string
          input_log: Json
          length_ticks?: number
          puzzle: Json
          recorded_at?: string
          seed: number
          start_tick?: number
        }
        Update: {
          example_id?: string | null
          game_type?: string
          input_log?: Json
          length_ticks?: number
          puzzle?: Json
          recorded_at?: string
          seed?: number
          start_tick?: number
        }
        Relationships: []
      }
      room_messages: {
        Row: {
          created_at: string
          duel_id: string
          id: string
          sender_name: string
          sender_user_id: string
          text: string
        }
        Insert: {
          created_at?: string
          duel_id: string
          id?: string
          sender_name: string
          sender_user_id: string
          text: string
        }
        Update: {
          created_at?: string
          duel_id?: string
          id?: string
          sender_name?: string
          sender_user_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
        ]
      }
      room_reports: {
        Row: {
          created_at: string
          duel_id: string
          id: string
          message_id: string | null
          reporter_user_id: string
        }
        Insert: {
          created_at?: string
          duel_id: string
          id?: string
          message_id?: string | null
          reporter_user_id: string
        }
        Update: {
          created_at?: string
          duel_id?: string
          id?: string
          message_id?: string | null
          reporter_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_reports_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "room_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      round_results: {
        Row: {
          answer: string | null
          correct_count: number | null
          duel_id: string
          errors: number | null
          extra: Json | null
          id: string
          is_correct: boolean
          ms_remaining: number
          player_slot: number
          reaction_avg_ms: number | null
          round_number: number
          score: number
          submitted_at: string
        }
        Insert: {
          answer?: string | null
          correct_count?: number | null
          duel_id: string
          errors?: number | null
          extra?: Json | null
          id?: string
          is_correct?: boolean
          ms_remaining?: number
          player_slot: number
          reaction_avg_ms?: number | null
          round_number: number
          score?: number
          submitted_at?: string
        }
        Update: {
          answer?: string | null
          correct_count?: number | null
          duel_id?: string
          errors?: number | null
          extra?: Json | null
          id?: string
          is_correct?: boolean
          ms_remaining?: number
          player_slot?: number
          reaction_avg_ms?: number | null
          round_number?: number
          score?: number
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_results_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
        ]
      }
      unblock_bank: {
        Row: {
          created_at: string
          id: number
          last_used_at: string | null
          layout: string
          min_moves: number
          solution: string
        }
        Insert: {
          created_at?: string
          id?: number
          last_used_at?: string | null
          layout: string
          min_moves: number
          solution: string
        }
        Update: {
          created_at?: string
          id?: number
          last_used_at?: string | null
          layout?: string
          min_moves?: number
          solution?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      disband_stale_room: { Args: { p_room_id: string }; Returns: boolean }
      duel_round_ended: {
        Args: { _duel_id: string; _round: number }
        Returns: boolean
      }
      is_duel_participant: { Args: { _duel_id: string }; Returns: boolean }
      my_duel_slot: { Args: { _duel_id: string }; Returns: number }
      restart_duel_room: {
        Args: { p_host_id: string; p_room_id: string }
        Returns: boolean
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
