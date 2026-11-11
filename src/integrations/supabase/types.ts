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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      catalogue_items: {
        Row: {
          animated: boolean
          bundle: string | null
          created_at: string
          exclusive: boolean
          exclusive_forever: boolean
          game: string | null
          game_type: string | null
          html_path: string | null
          id: string
          kind: string
          name: string
          note: string | null
          pass_level: number | null
          png_path: string | null
          price_coins: number | null
          rarity: string | null
          slot: string
          sort_order: number
          source: string
        }
        Insert: {
          animated: boolean
          bundle?: string | null
          created_at?: string
          exclusive: boolean
          exclusive_forever?: boolean
          game?: string | null
          game_type?: string | null
          html_path?: string | null
          id: string
          kind: string
          name: string
          note?: string | null
          pass_level?: number | null
          png_path?: string | null
          price_coins?: number | null
          rarity?: string | null
          slot: string
          sort_order?: number
          source: string
        }
        Update: {
          animated?: boolean
          bundle?: string | null
          created_at?: string
          exclusive?: boolean
          exclusive_forever?: boolean
          game?: string | null
          game_type?: string | null
          html_path?: string | null
          id?: string
          kind?: string
          name?: string
          note?: string | null
          pass_level?: number | null
          png_path?: string | null
          price_coins?: number | null
          rarity?: string | null
          slot?: string
          sort_order?: number
          source?: string
        }
        Relationships: []
      }
      coin_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: number
          idempotency_key: string
          reason: string
          ref_id: string | null
          ref_kind: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: number
          idempotency_key: string
          reason: string
          ref_id?: string | null
          ref_kind?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: number
          idempotency_key?: string
          reason?: string
          ref_id?: string | null
          ref_kind?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coin_wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consumable_balances: {
        Row: {
          count: number
          kind: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          kind: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          kind?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consumable_kinds: {
        Row: {
          kind: string
          name: string
        }
        Insert: {
          kind: string
          name: string
        }
        Update: {
          kind?: string
          name?: string
        }
        Relationships: []
      }
      consumable_ledger: {
        Row: {
          amount: number
          count_after: number
          created_at: string
          id: number
          idempotency_key: string
          kind: string
          reason: string
          ref_id: string | null
          ref_kind: string | null
          user_id: string
        }
        Insert: {
          amount: number
          count_after: number
          created_at?: string
          id?: number
          idempotency_key: string
          kind: string
          reason: string
          ref_id?: string | null
          ref_kind?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          count_after?: number
          created_at?: string
          id?: number
          idempotency_key?: string
          kind?: string
          reason?: string
          ref_id?: string | null
          ref_kind?: string | null
          user_id?: string
        }
        Relationships: []
      }
      economy_reasons: {
        Row: {
          note: string | null
          reason: string
        }
        Insert: {
          note?: string | null
          reason: string
        }
        Update: {
          note?: string | null
          reason?: string
        }
        Relationships: []
      }
      gem_unlocks: {
        Row: {
          gem: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          gem: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          gem?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          acquired_at: string
          how: string
          item_id: string
          ledger_id: number | null
          user_id: string
        }
        Insert: {
          acquired_at?: string
          how: string
          item_id: string
          ledger_id?: number | null
          user_id: string
        }
        Update: {
          acquired_at?: string
          how?: string
          item_id?: string
          ledger_id?: number | null
          user_id?: string
        }
        Relationships: []
      }
      loadout_slots: {
        Row: {
          equipped_at: string
          item_id: string
          slot: string
          user_id: string
        }
        Insert: {
          equipped_at?: string
          item_id: string
          slot: string
          user_id: string
        }
        Update: {
          equipped_at?: string
          item_id?: string
          slot?: string
          user_id?: string
        }
        Relationships: []
      }
      loadouts: {
        Row: {
          accent: string | null
          accessory: string | null
          avatar_id: string
          background: string | null
          feature: string | null
          gem: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accent?: string | null
          accessory?: string | null
          avatar_id?: string
          background?: string | null
          feature?: string | null
          gem?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accent?: string | null
          accessory?: string | null
          avatar_id?: string
          background?: string | null
          feature?: string | null
          gem?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      avatar_options: {
        Row: {
          avatar_id: string
          is_default: boolean
          kind: string
          option_id: string
          sort_order: number
        }
        Insert: {
          avatar_id: string
          is_default?: boolean
          kind: string
          option_id: string
          sort_order?: number
        }
        Update: {
          avatar_id?: string
          is_default?: boolean
          kind?: string
          option_id?: string
          sort_order?: number
        }
        Relationships: []
      }
      async_attempts: {
        Row: {
          colour: number | null
          display_name: string
          finished_at: string | null
          icon: string | null
          id: string
          room_id: string
          round_scores: Json
          rounds_done: number
          started_at: string
          tie_ms: number
          total_score: number
          user_id: string
        }
        Insert: {
          colour?: number | null
          display_name: string
          finished_at?: string | null
          icon?: string | null
          id?: string
          room_id: string
          round_scores?: Json
          rounds_done?: number
          started_at?: string
          tie_ms?: number
          total_score?: number
          user_id: string
        }
        Update: {
          colour?: number | null
          display_name?: string
          finished_at?: string | null
          icon?: string | null
          id?: string
          room_id?: string
          round_scores?: Json
          rounds_done?: number
          started_at?: string
          tie_ms?: number
          total_score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "async_attempts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "async_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      async_events: {
        Row: {
          at: string
          attempt_id: string
          event: string
          id: number
          kind: string
          reason: string | null
          room_id: string
          round_number: number
          user_id: string | null
        }
        Insert: {
          at?: string
          attempt_id: string
          event: string
          id?: never
          kind: string
          reason?: string | null
          room_id: string
          round_number?: number
          user_id?: string | null
        }
        Update: {
          at?: string
          attempt_id?: string
          event?: string
          id?: never
          kind?: string
          reason?: string | null
          room_id?: string
          round_number?: number
          user_id?: string | null
        }
        Relationships: []
      }
      async_results: {
        Row: {
          answer: string | null
          answered: boolean
          answered_at: string | null
          attempt_id: string
          correct_count: number | null
          errors: number | null
          extra: Json | null
          id: string
          input_type: string | null
          is_correct: boolean
          missed: boolean
          ms_remaining: number
          reaction_avg_ms: number | null
          room_id: string
          round_number: number
          score: number
          started_at: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          answered?: boolean
          answered_at?: string | null
          attempt_id: string
          correct_count?: number | null
          errors?: number | null
          extra?: Json | null
          id?: string
          input_type?: string | null
          is_correct?: boolean
          missed?: boolean
          ms_remaining?: number
          reaction_avg_ms?: number | null
          room_id: string
          round_number: number
          score?: number
          started_at: string
          user_id: string
        }
        Update: {
          answer?: string | null
          answered?: boolean
          answered_at?: string | null
          attempt_id?: string
          correct_count?: number | null
          errors?: number | null
          extra?: Json | null
          id?: string
          input_type?: string | null
          is_correct?: boolean
          missed?: boolean
          ms_remaining?: number
          reaction_avg_ms?: number | null
          room_id?: string
          round_number?: number
          score?: number
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "async_results_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "async_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "async_results_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "async_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      async_room_secrets: {
        Row: {
          puzzles_private: Json
          room_id: string
          round_records: Json | null
        }
        Insert: {
          puzzles_private?: Json
          room_id: string
          round_records?: Json | null
        }
        Update: {
          puzzles_private?: Json
          room_id?: string
          round_records?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "async_room_secrets_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "async_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      async_rooms: {
        Row: {
          closes_at: string
          created_at: string
          created_by: string | null
          day: string | null
          id: string
          kind: string
          opens_at: string
          puzzles_public: Json
          room_key: string
          round_count: number
          round_order: Json
          seed: number
        }
        Insert: {
          closes_at: string
          created_at?: string
          created_by?: string | null
          day?: string | null
          id?: string
          kind: string
          opens_at: string
          puzzles_public?: Json
          room_key: string
          round_count: number
          round_order?: Json
          seed: number
        }
        Update: {
          closes_at?: string
          created_at?: string
          created_by?: string | null
          day?: string | null
          id?: string
          kind?: string
          opens_at?: string
          puzzles_public?: Json
          room_key?: string
          round_count?: number
          round_order?: Json
          seed?: number
        }
        Relationships: []
      }
      challenge_events: {
        Row: {
          at: string
          code: string | null
          event: string
          id: number
          room_id: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          at?: string
          code?: string | null
          event: string
          id?: never
          room_id?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          at?: string
          code?: string | null
          event?: string
          id?: never
          room_id?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      challenges: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          room_id: string
          round_count: number
          selected_categories: string[]
          source: string
          source_duel_id: string | null
          source_game_index: number | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at: string
          room_id: string
          round_count: number
          selected_categories?: string[]
          source: string
          source_duel_id?: string | null
          source_game_index?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          room_id?: string
          round_count?: number
          selected_categories?: string[]
          source?: string
          source_duel_id?: string | null
          source_game_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "challenges_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "async_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_players: {
        Row: {
          colour: number | null
          created_at: string
          display_name: string
          duel_id: string
          icon: string | null
          id: string
          intro_ready_round: number
          joined_at: string
          last_reaction_at: string | null
          last_seen_at: string
          muted_by_host: boolean
          player_slot: number
          ready_round: number
          status: string
          submitted_round: number
          user_id: string
        }
        Insert: {
          colour?: number | null
          created_at?: string
          display_name: string
          duel_id: string
          icon?: string | null
          id?: string
          intro_ready_round?: number
          joined_at?: string
          last_reaction_at?: string | null
          last_seen_at?: string
          muted_by_host?: boolean
          player_slot: number
          ready_round?: number
          status?: string
          submitted_round?: number
          user_id: string
        }
        Update: {
          colour?: number | null
          created_at?: string
          display_name?: string
          duel_id?: string
          icon?: string | null
          id?: string
          intro_ready_round?: number
          joined_at?: string
          last_reaction_at?: string | null
          last_seen_at?: string
          muted_by_host?: boolean
          player_slot?: number
          ready_round?: number
          status?: string
          submitted_round?: number
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
      duel_players_archive: {
        Row: {
          archive_id: number
          archived_at: string
          created_at: string | null
          display_name: string
          duel_id: string
          game_index: number
          id: string
          intro_ready_round: number | null
          joined_at: string | null
          last_seen_at: string | null
          muted_by_host: boolean | null
          player_slot: number
          ready_round: number | null
          status: string
          user_id: string
        }
        Insert: {
          archive_id?: never
          archived_at?: string
          created_at?: string | null
          display_name: string
          duel_id: string
          game_index: number
          id: string
          intro_ready_round?: number | null
          joined_at?: string | null
          last_seen_at?: string | null
          muted_by_host?: boolean | null
          player_slot: number
          ready_round?: number | null
          status: string
          user_id: string
        }
        Update: {
          archive_id?: never
          archived_at?: string
          created_at?: string | null
          display_name?: string
          duel_id?: string
          game_index?: number
          id?: string
          intro_ready_round?: number | null
          joined_at?: string | null
          last_seen_at?: string | null
          muted_by_host?: boolean | null
          player_slot?: number
          ready_round?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      duel_presence: {
        Row: {
          duel_id: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          duel_id: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          duel_id?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_presence_player_fkey"
            columns: ["duel_id", "user_id"]
            isOneToOne: true
            referencedRelation: "duel_players"
            referencedColumns: ["duel_id", "user_id"]
          },
        ]
      }
      duel_secrets: {
        Row: {
          created_at: string
          duel_id: string
          puzzles_private: Json
          round_records: Json | null
        }
        Insert: {
          created_at?: string
          duel_id: string
          puzzles_private: Json
          round_records?: Json | null
        }
        Update: {
          created_at?: string
          duel_id?: string
          puzzles_private?: Json
          round_records?: Json | null
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
          scoring_mode: string
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
          scoring_mode?: string
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
          scoring_mode?: string
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
      practice_plays: {
        Row: {
          created_at: string
          duration_ms: number
          example: boolean
          flagged: boolean
          game_id: string
          id: number
          input_type: string | null
          is_correct: boolean
          ms_remaining: number
          revision: Json
          score: number
          time_limit_ms: number
          timed_out: boolean
          user_id: string | null
          breakdown: Json | null
          level: string | null
          progress_counted_at: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          example?: boolean
          flagged?: boolean
          game_id: string
          id?: never
          input_type?: string | null
          is_correct?: boolean
          ms_remaining?: number
          revision?: Json
          score?: number
          time_limit_ms?: number
          timed_out?: boolean
          user_id?: string | null
          breakdown?: Json | null
          level?: string | null
          progress_counted_at?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number
          example?: boolean
          flagged?: boolean
          game_id?: string
          id?: never
          input_type?: string | null
          is_correct?: boolean
          ms_remaining?: number
          revision?: Json
          score?: number
          time_limit_ms?: number
          timed_out?: boolean
          user_id?: string | null
          breakdown?: Json | null
          level?: string | null
          progress_counted_at?: string | null
        }
        Relationships: []
      }
      practice_progress: {
        Row: {
          best_at: string
          best_play_id: number | null
          best_score: number
          game_id: string
          level: string
          star_at: string | null
          star_score: number | null
          user_id: string
        }
        Insert: {
          best_at?: string
          best_play_id?: number | null
          best_score: number
          game_id: string
          level: string
          star_at?: string | null
          star_score?: number | null
          user_id: string
        }
        Update: {
          best_at?: string
          best_play_id?: number | null
          best_score?: number
          game_id?: string
          level?: string
          star_at?: string | null
          star_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      practice_progress_start: {
        Row: { fresh_start_at: string; id: boolean }
        Insert: { fresh_start_at?: string; id?: boolean }
        Update: { fresh_start_at?: string; id?: boolean }
        Relationships: []
      }
      practice_refresh_notes: {
        Row: { seen_at: string; user_id: string }
        Insert: { seen_at?: string; user_id: string }
        Update: { seen_at?: string; user_id?: string }
        Relationships: []
      }
      profiles: {
        Row: {
          colour: number
          country: string | null
          created_at: string
          date_of_birth: string
          deletion_requested_at: string | null
          founding: boolean
          free_change_used: boolean
          player_number: number
          status: string
          user_id: string
          username: string
          username_changed_at: string | null
          username_key: string
        }
        Insert: {
          colour: number
          country?: string | null
          created_at?: string
          date_of_birth: string
          deletion_requested_at?: string | null
          founding?: boolean
          free_change_used?: boolean
          player_number?: number
          status?: string
          user_id: string
          username: string
          username_changed_at?: string | null
          username_key: string
        }
        Update: {
          colour?: number
          country?: string | null
          created_at?: string
          date_of_birth?: string
          deletion_requested_at?: string | null
          founding?: boolean
          free_change_used?: boolean
          player_number?: number
          status?: string
          user_id?: string
          username?: string
          username_changed_at?: string | null
          username_key?: string
        }
        Relationships: []
      }
      rate_limit_hits: {
        Row: {
          bucket: string
          hits: number
          user_id: string
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          user_id: string
          window_start?: string
        }
        Update: {
          bucket?: string
          hits?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      room_events: {
        Row: {
          at: string
          duel_id: string
          event: string
          game_index: number
          id: number
          reason: string | null
          round_number: number
        }
        Insert: {
          at?: string
          duel_id: string
          event: string
          game_index?: number
          id?: never
          reason?: string | null
          round_number?: number
        }
        Update: {
          at?: string
          duel_id?: string
          event?: string
          game_index?: number
          id?: never
          reason?: string | null
          round_number?: number
        }
        Relationships: []
      }
      room_joins: {
        Row: {
          duel_id: string
          game_index: number
          id: number
          joined_at: string
          player_slot: number
          rejoin: boolean
          user_id: string
          via: string | null
        }
        Insert: {
          duel_id: string
          game_index?: number
          id?: never
          joined_at?: string
          player_slot: number
          rejoin?: boolean
          user_id: string
          via?: string | null
        }
        Update: {
          duel_id?: string
          game_index?: number
          id?: never
          joined_at?: string
          player_slot?: number
          rejoin?: boolean
          user_id?: string
          via?: string | null
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
          counts: boolean
          message_text: string | null
          reason: string | null
          reported_name: string | null
          reported_user_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          uk_day: string | null
          reporter_user_id: string
        }
        Insert: {
          created_at?: string
          duel_id: string
          id?: string
          message_id?: string | null
          counts?: boolean
          message_text?: string | null
          reason?: string | null
          reported_name?: string | null
          reported_user_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          uk_day?: string | null
          reporter_user_id: string
        }
        Update: {
          created_at?: string
          duel_id?: string
          id?: string
          message_id?: string | null
          counts?: boolean
          message_text?: string | null
          reason?: string | null
          reported_name?: string | null
          reported_user_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          uk_day?: string | null
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
          input_type: string | null
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
          input_type?: string | null
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
          input_type?: string | null
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
      round_results_archive: {
        Row: {
          answer: string | null
          archive_id: number
          archived_at: string
          correct_count: number | null
          duel_id: string
          errors: number | null
          extra: Json | null
          game_id: string | null
          game_index: number
          id: string
          input_type: string | null
          is_correct: boolean
          ms_remaining: number
          player_slot: number
          reaction_avg_ms: number | null
          revision: Json | null
          round_number: number
          score: number
          submitted_at: string
          time_limit_ms: number | null
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          archive_id?: never
          archived_at?: string
          correct_count?: number | null
          duel_id: string
          errors?: number | null
          extra?: Json | null
          game_id?: string | null
          game_index: number
          id: string
          input_type?: string | null
          is_correct: boolean
          ms_remaining: number
          player_slot: number
          reaction_avg_ms?: number | null
          revision?: Json | null
          round_number: number
          score: number
          submitted_at: string
          time_limit_ms?: number | null
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          archive_id?: never
          archived_at?: string
          correct_count?: number | null
          duel_id?: string
          errors?: number | null
          extra?: Json | null
          game_id?: string | null
          game_index?: number
          id?: string
          input_type?: string | null
          is_correct?: boolean
          ms_remaining?: number
          player_slot?: number
          reaction_avg_ms?: number | null
          revision?: Json | null
          round_number?: number
          score?: number
          submitted_at?: string
          time_limit_ms?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      share_events: {
        Row: {
          challenge_code: string | null
          created_at: string
          daily_kind: string | null
          duel_id: string | null
          event: string
          game_index: number | null
          id: number
          landing: string | null
          method: string | null
          place: number | null
          players: number | null
          room_code: string | null
          rounds: number | null
          source: string
          user_id: string
          welcome: string | null
        }
        Insert: {
          challenge_code?: string | null
          created_at?: string
          daily_kind?: string | null
          duel_id?: string | null
          event: string
          game_index?: number | null
          id?: never
          landing?: string | null
          method?: string | null
          place?: number | null
          players?: number | null
          room_code?: string | null
          rounds?: number | null
          source?: string
          user_id: string
          welcome?: string | null
        }
        Update: {
          challenge_code?: string | null
          created_at?: string
          daily_kind?: string | null
          duel_id?: string | null
          event?: string
          game_index?: number | null
          id?: never
          landing?: string | null
          method?: string | null
          place?: number | null
          players?: number | null
          room_code?: string | null
          rounds?: number | null
          source?: string
          user_id?: string
          welcome?: string | null
        }
        Relationships: []
      }
      terms_events: {
        Row: {
          agreed_at: string
          created_at: string
          id: number
          terms_version: number
          user_id: string
        }
        Insert: {
          agreed_at: string
          created_at?: string
          id?: never
          terms_version: number
          user_id: string
        }
        Update: {
          agreed_at?: string
          created_at?: string
          id?: never
          terms_version?: number
          user_id?: string
        }
        Relationships: []
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
      catalogue_shop: {
        Row: {
          animated: boolean | null
          bundle: string | null
          created_at: string | null
          exclusive: boolean | null
          exclusive_forever: boolean | null
          game: string | null
          game_type: string | null
          html_path: string | null
          id: string | null
          kind: string | null
          name: string | null
          note: string | null
          pass_level: number | null
          png_path: string | null
          price_coins: number | null
          rarity: string | null
          slot: string | null
          sort_order: number | null
          source: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      economy_credit: {
        Args: { p_amount: number; p_key: string; p_reason: string; p_ref_id: string | null; p_ref_kind: string | null; p_user_id: string }
        Returns: Json
      }
      economy_spend: {
        Args: { p_amount: number; p_key: string; p_reason: string; p_ref_id: string | null; p_ref_kind: string | null; p_user_id: string }
        Returns: Json
      }
      economy_refund: { Args: { p_line_id: number; p_user_id: string }; Returns: Json }
      economy_purchase_item: { Args: { p_item_id: string; p_key: string; p_user_id: string }; Returns: Json }
      economy_grant_item: { Args: { p_how: string; p_item_id: string; p_user_id: string }; Returns: string }
      economy_grant_consumable: {
        Args: { p_amount: number; p_key: string; p_kind: string; p_reason: string; p_ref_id: string | null; p_ref_kind: string | null; p_user_id: string }
        Returns: Json
      }
      economy_use_consumable: {
        Args: { p_amount: number; p_key: string; p_kind: string; p_reason: string; p_ref_id: string | null; p_ref_kind: string | null; p_user_id: string }
        Returns: Json
      }
      economy_equip: { Args: { p_item_id: string | null; p_slot: string; p_user_id: string }; Returns: string }
      economy_set_avatar: {
        Args: {
          p_accent: string | null
          p_accessory: string | null
          p_avatar_id: string
          p_background: string | null
          p_colour: number
          p_feature: string | null
          p_gem: string | null
          p_user_id: string
        }
        Returns: string
      }
      practice_record_play: { Args: { p_play_id: number }; Returns: Json }
      practice_mark_refresh_note_seen: { Args: { p_user_id: string }; Returns: boolean }
      practice_refresh_note_due: { Args: { p_user_id: string }; Returns: boolean }
      practice_star_total: { Args: { p_user_id: string }; Returns: number }
      practice_sync_gems: { Args: { p_user_id: string }; Returns: string[] }
      practice_gems_for: { Args: { p_stars: number }; Returns: string[] }
      economy_public_cards: {
        Args: { p_user_ids: string[] }
        Returns: {
          accent: string | null
          accessory: string | null
          avatar_id: string
          background: string | null
          card_art: string | null
          feature: string | null
          colour: number
          founding: boolean
          frame: string | null
          gem: string | null
          name_colour: string | null
          player_number: number
          user_id: string
          username: string
        }[]
      }
      async_board_open: { Args: { p_room_id: string }; Returns: boolean }
      disband_stale_room: { Args: { p_room_id: string }; Returns: boolean }
      duel_round_ended: {
        Args: { _duel_id: string; _round: number }
        Returns: boolean
      }
      is_duel_participant: { Args: { _duel_id: string }; Returns: boolean }
      my_duel_slot: { Args: { _duel_id: string }; Returns: number }
      create_profile: {
        Args: {
          p_colour: number
          p_country: string | null
          p_date_of_birth: string
          p_user_id: string
          p_username: string
        }
        Returns: string
      }
      guest_progress: { Args: { p_user_id: string }; Returns: Json }
      file_room_report: {
        Args: {
          p_duel_id: string
          p_message_id: string | null
          p_message_text: string | null
          p_reason: string
          p_reported_name: string | null
          p_reported_user_id: string | null
          p_reporter_user_id: string
        }
        Returns: Json
      }
      moderation_status: { Args: { p_user_id: string }; Returns: Json }
      moderation_ack: { Args: { p_user_id: string; p_kind: string; p_detail?: Json | null }; Returns: boolean }
      network_key: { Args: { p_address: string }; Returns: string }
      public_profiles: {
        Args: { p_user_ids: string[] }
        Returns: {
          colour: number | null
          founding: boolean
          player_number: number | null
          user_id: string
          username: string
        }[]
      }
      rename_profile: {
        Args: {
          p_expected_changed_at: string | null
          p_kind: string
          p_note?: string | null
          p_user_id: string
          p_username: string
        }
        Returns: string
      }
      username_status: { Args: { p_user_id: string; p_username: string }; Returns: string }
      restart_duel_room: {
        Args: { p_host_id: string; p_room_id: string }
        Returns: boolean
      }
      record_analytics_events: { Args: { p_events: Json }; Returns: number }
      take_rate_limit: {
        Args: {
          p_bucket: string
          p_max: number
          p_user_id: string
          p_window_seconds: number
        }
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
