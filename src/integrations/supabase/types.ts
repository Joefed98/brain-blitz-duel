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
      badges: {
        Row: {
          coins: number
          grp: string
          name: string
          rarity: string
          rule: string
          slug: string
          sort_order: number
          status: string
          target_need: number | null
          target_unit: string | null
          waits_for: string | null
        }
        Insert: {
          coins: number
          grp: string
          name: string
          rarity: string
          rule: string
          slug: string
          sort_order: number
          status: string
          target_need?: number | null
          target_unit?: string | null
          waits_for?: string | null
        }
        Update: {
          coins?: number
          grp?: string
          name?: string
          rarity?: string
          rule?: string
          slug?: string
          sort_order?: number
          status?: string
          target_need?: number | null
          target_unit?: string | null
          waits_for?: string | null
        }
        Relationships: []
      }
      titles: {
        Row: {
          badge: string | null
          id: string
          kind: string
          name: string
          sort_order: number
        }
        Insert: {
          badge?: string | null
          id: string
          kind: string
          name: string
          sort_order: number
        }
        Update: {
          badge?: string | null
          id?: string
          kind?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      player_badges: {
        Row: {
          badge: string
          detail: Json
          earned_at: string
          seen_at: string | null
          user_id: string
        }
        Insert: {
          badge: string
          detail?: Json
          earned_at?: string
          seen_at?: string | null
          user_id: string
        }
        Update: {
          badge?: string
          detail?: Json
          earned_at?: string
          seen_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      card_badges: {
        Row: {
          badge: string
          position: number
          user_id: string
        }
        Insert: {
          badge: string
          position: number
          user_id: string
        }
        Update: {
          badge?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      card_titles: {
        Row: {
          equipped_at: string
          title: string
          user_id: string
        }
        Insert: {
          equipped_at?: string
          title: string
          user_id: string
        }
        Update: {
          equipped_at?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_streak_freezes: {
        Row: {
          consumable_line: number | null
          day: string
          used_at: string
          user_id: string
        }
        Insert: {
          consumable_line?: number | null
          day: string
          used_at?: string
          user_id: string
        }
        Update: {
          consumable_line?: number | null
          day?: string
          used_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      practice_challenge_deals: {
        Row: { deal_key: string; graded_at: string; user_id: string }
        Insert: { deal_key: string; graded_at?: string; user_id: string }
        Update: { deal_key?: string; graded_at?: string; user_id?: string }
        Relationships: []
      }
      practice_challenge_progress: {
        Row: {
          best: number
          challenge_id: string
          coins: number
          completed_at: string | null
          game_id: string
          ledger_id: number | null
          paid_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          best?: number
          challenge_id: string
          coins?: number
          completed_at?: string | null
          game_id: string
          ledger_id?: number | null
          paid_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          best?: number
          challenge_id?: string
          coins?: number
          completed_at?: string | null
          game_id?: string
          ledger_id?: number | null
          paid_at?: string | null
          updated_at?: string
          user_id?: string
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
      notification_log: {
        Row: {
          counts_cap: boolean
          dedupe_key: string | null
          event: string
          id: number
          sent_at: string
          user_id: string
        }
        Insert: {
          counts_cap: boolean
          dedupe_key?: string | null
          event: string
          id?: number
          sent_at?: string
          user_id: string
        }
        Update: {
          counts_cap?: boolean
          dedupe_key?: string | null
          event?: string
          id?: number
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          asked_at: string | null
          daily_streak: boolean
          declined_at: string | null
          enabled: boolean
          friend_accepted: boolean
          friend_challenge: boolean
          friend_request: boolean
          room_invite: boolean
          tournament_starting: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          asked_at?: string | null
          daily_streak?: boolean
          declined_at?: string | null
          enabled?: boolean
          friend_accepted?: boolean
          friend_challenge?: boolean
          friend_request?: boolean
          room_invite?: boolean
          tournament_starting?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          asked_at?: string | null
          daily_streak?: boolean
          declined_at?: string | null
          enabled?: boolean
          friend_accepted?: boolean
          friend_challenge?: boolean
          friend_request?: boolean
          room_invite?: boolean
          tournament_starting?: boolean
          updated_at?: string
          user_id?: string
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
      mm_match_players: {
        Row: {
          match_id: string
          placement: boolean
          rating_before: number
          rematch_at: string | null
          slot: number
          user_id: string
        }
        Insert: {
          match_id: string
          placement?: boolean
          rating_before: number
          rematch_at?: string | null
          slot: number
          user_id: string
        }
        Update: {
          match_id?: string
          placement?: boolean
          rating_before?: number
          rematch_at?: string | null
          slot?: number
          user_id?: string
        }
        Relationships: []
      }
      mm_matches: {
        Row: {
          choice: string
          created_at: string
          duel_id: string | null
          finished_at: string | null
          format: string
          game_mode: string
          id: string
          kind: string
          recorded_at: string | null
          recorded_fallback: boolean | null
          recorded_games: Json | null
          recorded_key: string | null
          recorded_look: Json | null
          recorded_owner: string | null
          recorded_owner_rating: number | null
          recorded_source: string | null
          rematch_match_id: string | null
          rematch_of: string | null
          result: Json | null
          settled_at: string | null
          status: string
        }
        Insert: {
          choice: string
          created_at?: string
          duel_id?: string | null
          finished_at?: string | null
          format: string
          game_mode?: string
          id: string
          kind: string
          recorded_at?: string | null
          recorded_fallback?: boolean | null
          recorded_games?: Json | null
          recorded_key?: string | null
          recorded_look?: Json | null
          recorded_owner?: string | null
          recorded_owner_rating?: number | null
          recorded_source?: string | null
          rematch_match_id?: string | null
          rematch_of?: string | null
          result?: Json | null
          settled_at?: string | null
          status?: string
        }
        Update: {
          choice?: string
          created_at?: string
          duel_id?: string | null
          finished_at?: string | null
          format?: string
          game_mode?: string
          id?: string
          kind?: string
          recorded_at?: string | null
          recorded_fallback?: boolean | null
          recorded_games?: Json | null
          recorded_key?: string | null
          recorded_look?: Json | null
          recorded_owner?: string | null
          recorded_owner_rating?: number | null
          recorded_source?: string | null
          rematch_match_id?: string | null
          rematch_of?: string | null
          result?: Json | null
          settled_at?: string | null
          status?: string
        }
        Relationships: []
      }
      mm_practice_deals: {
        Row: {
          answer: string | null
          flagged: boolean
          game: string
          ms_remaining: number
          play_id: number
          puzzle: Json
          reaction_avg_ms: number | null
          recorded_at: string
          score: number
          user_id: string
        }
        Insert: {
          answer?: string | null
          flagged?: boolean
          game: string
          ms_remaining: number
          play_id: number
          puzzle: Json
          reaction_avg_ms?: number | null
          recorded_at?: string
          score: number
          user_id: string
        }
        Update: {
          answer?: string | null
          flagged?: boolean
          game?: string
          ms_remaining?: number
          play_id?: number
          puzzle?: Json
          reaction_avg_ms?: number | null
          recorded_at?: string
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      mm_progress: {
        Row: {
          at: string
          match_id: string
          round_number: number
          score: number
          user_id: string
        }
        Insert: {
          at?: string
          match_id: string
          round_number: number
          score: number
          user_id: string
        }
        Update: {
          at?: string
          match_id?: string
          round_number?: number
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      mm_queue: {
        Row: {
          choice: string
          format: string
          joined_at: string
          match_id: string | null
          display_name: string | null
          placement: boolean
          rating: number
          user_id: string
        }
        Insert: {
          choice: string
          format: string
          display_name?: string | null
          joined_at?: string
          match_id?: string | null
          placement?: boolean
          rating: number
          user_id: string
        }
        Update: {
          choice?: string
          format?: string
          display_name?: string | null
          joined_at?: string
          match_id?: string | null
          placement?: boolean
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      mm_run_uses: {
        Row: {
          id: number
          match_id: string
          run_key: string
          used_at: string
          viewer_id: string
        }
        Insert: {
          id?: never
          match_id: string
          run_key: string
          used_at?: string
          viewer_id: string
        }
        Update: {
          id?: never
          match_id?: string
          run_key?: string
          used_at?: string
          viewer_id?: string
        }
        Relationships: []
      }
      mm_runs: {
        Row: {
          choice: string
          duel_id: string
          format: string
          games: Json
          key: string
          look: Json | null
          match_id: string
          owner_id: string
          owner_rating: number
          recorded_at: string
          slot: number
        }
        Insert: {
          choice: string
          duel_id: string
          format: string
          games: Json
          key: string
          look?: Json | null
          match_id: string
          owner_id: string
          owner_rating: number
          recorded_at?: string
          slot: number
        }
        Update: {
          choice?: string
          duel_id?: string
          format?: string
          games?: Json
          key?: string
          look?: Json | null
          match_id?: string
          owner_id?: string
          owner_rating?: number
          recorded_at?: string
          slot?: number
        }
        Relationships: []
      }
      push_friend_deliveries: {
        Row: {
          claimed_at: string
          event_id: number
        }
        Insert: {
          claimed_at?: string
          event_id: number
        }
        Update: {
          claimed_at?: string
          event_id?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          platform: string | null
          time_zone: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          platform?: string | null
          time_zone?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          platform?: string | null
          time_zone?: string
          user_id?: string
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
      shop_days: {
        Row: { backups: Json; created_at: string; day: string; items: string[]; rarities: string[] }
        Insert: { backups?: Json; created_at?: string; day: string; items: string[]; rarities: string[] }
        Update: { backups?: Json; created_at?: string; day?: string; items?: string[]; rarities?: string[] }
        Relationships: []
      }
      shop_weeks: {
        Row: { bundle_id: string; created_at: string; full_price: number; items: string[]; name: string; price: number; week_start: string }
        Insert: { bundle_id: string; created_at?: string; full_price: number; items: string[]; name: string; price: number; week_start: string }
        Update: { bundle_id?: string; created_at?: string; full_price?: number; items?: string[]; name?: string; price?: number; week_start?: string }
        Relationships: []
      }
      pass_seasons: {
        Row: { created_at: string; ends_at: string | null; id: string; kind: string; name: string; reset_at: string | null; starts_at: string | null; updated_at: string }
        Insert: { created_at?: string; ends_at?: string | null; id: string; kind: string; name: string; reset_at?: string | null; starts_at?: string | null; updated_at?: string }
        Update: { created_at?: string, ends_at?: string | null, id?: string, kind?: string, name?: string, reset_at?: string | null, starts_at?: string | null, updated_at?: string }
        Relationships: []
      }
      pass_member_resets: {
        Row: { reset_at: string; season_id: string; user_id: string }
        Insert: { reset_at: string; season_id: string; user_id: string }
        Update: { reset_at?: string, season_id?: string, user_id?: string }
        Relationships: []
      }
      pass_joules: {
        Row: { amount: number; at: string; base: number; created_at: string; epoch: number; id: number; kind: string; season_id: string; source_key: string; uk_day: string; user_id: string }
        Insert: { amount: number; at: string; base: number; created_at?: string; epoch: number; id?: number; kind: string; season_id: string; source_key: string; uk_day: string; user_id: string }
        Update: { amount?: number, at?: string, base?: number, created_at?: string, epoch?: number, id?: number, kind?: string, season_id?: string, source_key?: string, uk_day?: string, user_id?: string }
        Relationships: []
      }
      pass_members: {
        Row: { created_at: string; epoch: number; level_reached: number; level_seen: number; season_id: string; user_id: string }
        Insert: { created_at?: string; epoch: number; level_reached?: number; level_seen?: number; season_id: string; user_id: string }
        Update: { created_at?: string, epoch?: number, level_reached?: number, level_seen?: number, season_id?: string, user_id?: string }
        Relationships: []
      }
      pass_premium: {
        Row: { grant_key: string; granted_at: string; removed_at: string | null; removed_note: string | null; season_id: string; source: string; user_id: string }
        Insert: { grant_key: string; granted_at?: string; removed_at?: string | null; removed_note?: string | null; season_id: string; source: string; user_id: string }
        Update: { grant_key?: string, granted_at?: string, removed_at?: string | null, removed_note?: string | null, season_id?: string, source?: string, user_id?: string }
        Relationships: []
      }
      pass_claims: {
        Row: { claimed_at: string; epoch: number; level: number; reward: Json; season_id: string; track: string; user_id: string }
        Insert: { claimed_at?: string; epoch: number; level: number; reward: Json; season_id: string; track: string; user_id: string }
        Update: { claimed_at?: string, epoch?: number, level?: number, reward?: Json, season_id?: string, track?: string, user_id?: string }
        Relationships: []
      }
      pass_title_unlocks: {
        Row: { season_id: string; title_id: string; unlocked_at: string; user_id: string }
        Insert: { season_id: string; title_id: string; unlocked_at?: string; user_id: string }
        Update: { season_id?: string, title_id?: string, unlocked_at?: string, user_id?: string }
        Relationships: []
      }
      pass_weeks: {
        Row: { created_at: string; easy: string; hard: string; medium: string; week_start: string }
        Insert: { created_at?: string; easy: string; hard: string; medium: string; week_start: string }
        Update: { created_at?: string, easy?: string, hard?: string, medium?: string, week_start?: string }
        Relationships: []
      }
      shop_wishlist: {
        Row: { created_at: string; item_id: string; user_id: string }
        Insert: { created_at?: string; item_id: string; user_id: string }
        Update: { created_at?: string; item_id?: string; user_id?: string }
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
      tournament_events: {
        Row: {
          async_room_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          ends_at: string
          entrants: number
          finished_at: string | null
          id: string
          kind: string
          pick: string
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          async_room_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          ends_at: string
          entrants?: number
          finished_at?: string | null
          id: string
          kind: string
          pick: string
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          async_room_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          ends_at?: string
          entrants?: number
          finished_at?: string | null
          id?: string
          kind?: string
          pick?: string
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      tournament_entries: {
        Row: {
          coins: number
          consumable_line: number | null
          entered_at: string
          entry: string
          event_id: string
          ledger_id: number | null
          refunded_at: string | null
          user_id: string
        }
        Insert: {
          coins?: number
          consumable_line?: number | null
          entered_at?: string
          entry: string
          event_id: string
          ledger_id?: number | null
          refunded_at?: string | null
          user_id: string
        }
        Update: {
          coins?: number
          consumable_line?: number | null
          entered_at?: string
          entry?: string
          event_id?: string
          ledger_id?: number | null
          refunded_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tournament_reminders: {
        Row: {
          asked_at: string
          event_id: string
          notified_at: string | null
          user_id: string
        }
        Insert: {
          asked_at?: string
          event_id: string
          notified_at?: string | null
          user_id: string
        }
        Update: {
          asked_at?: string
          event_id?: string
          notified_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tournament_arena_queue: {
        Row: {
          event_id: string
          joined_at: string
          last_opponent: string | null
          rating: number
          user_id: string
        }
        Insert: {
          event_id: string
          joined_at?: string
          last_opponent?: string | null
          rating: number
          user_id: string
        }
        Update: {
          event_id?: string
          joined_at?: string
          last_opponent?: string | null
          rating?: number
          user_id?: string
        }
        Relationships: []
      }
      tournament_arena_duels: {
        Row: {
          a_points: number
          a_score: number
          a_user: string
          b_points: number
          b_score: number
          b_user: string
          created_at: string
          duel_id: string | null
          event_id: string
          games: Json | null
          id: string
          settled_at: string | null
          status: string
          winner: string | null
        }
        Insert: {
          a_points?: number
          a_score?: number
          a_user: string
          b_points?: number
          b_score?: number
          b_user: string
          created_at?: string
          duel_id?: string | null
          event_id: string
          games?: Json | null
          id: string
          settled_at?: string | null
          status?: string
          winner?: string | null
        }
        Update: {
          a_points?: number
          a_score?: number
          a_user?: string
          b_points?: number
          b_score?: number
          b_user?: string
          created_at?: string
          duel_id?: string | null
          event_id?: string
          games?: Json | null
          id?: string
          settled_at?: string | null
          status?: string
          winner?: string | null
        }
        Relationships: []
      }
      tournament_arena_players: {
        Row: {
          best_streak: number
          draws: number
          event_id: string
          last_win_at: string | null
          losses: number
          played: number
          points: number
          score_total: number
          streak: number
          user_id: string
          wins: number
        }
        Insert: {
          best_streak?: number
          draws?: number
          event_id: string
          last_win_at?: string | null
          losses?: number
          played?: number
          points?: number
          score_total?: number
          streak?: number
          user_id: string
          wins?: number
        }
        Update: {
          best_streak?: number
          draws?: number
          event_id?: string
          last_win_at?: string | null
          losses?: number
          played?: number
          points?: number
          score_total?: number
          streak?: number
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      tournament_results: {
        Row: {
          event_id: string
          place: number
          points: number | null
          tie_ms: number | null
          total: number | null
          user_id: string
        }
        Insert: {
          event_id: string
          place: number
          points?: number | null
          tie_ms?: number | null
          total?: number | null
          user_id: string
        }
        Update: {
          event_id?: string
          place?: number
          points?: number | null
          tie_ms?: number | null
          total?: number | null
          user_id?: string
        }
        Relationships: []
      }
      tournament_prizes: {
        Row: {
          coins: number
          event_id: string
          ledger_id: number
          paid_at: string
          place: number
          user_id: string
        }
        Insert: {
          coins: number
          event_id: string
          ledger_id: number
          paid_at?: string
          place: number
          user_id: string
        }
        Update: {
          coins?: number
          event_id?: string
          ledger_id?: number
          paid_at?: string
          place?: number
          user_id?: string
        }
        Relationships: []
      }
      tournament_trophies: {
        Row: {
          awarded_at: string
          event_id: string
          kind: string
          medal: string
          place: number
          title: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          event_id: string
          kind: string
          medal: string
          place: number
          title: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          event_id?: string
          kind?: string
          medal?: string
          place?: number
          title?: string
          user_id?: string
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
      badge_award: { Args: { p_badge: string; p_detail: Json; p_user_id: string }; Returns: Json }
      badge_set_card: { Args: { p_badges: string[]; p_user_id: string }; Returns: string }
      badge_set_title: { Args: { p_title: string | null; p_user_id: string }; Returns: string }
      badge_mark_seen: { Args: { p_badges: string[]; p_user_id: string }; Returns: number }
      badge_public_cards: {
        Args: { p_user_ids: string[] }
        Returns: { badges: string[]; founding_number: number | null; title: string | null; user_id: string }[]
      }
      daily_streak_freeze: { Args: { p_day: string; p_user_id: string }; Returns: Json }
      badge_facts: { Args: { p_puzzle_limits: Json; p_user_id: string }; Returns: Json }
      daily_history: {
        Args: { p_user_id: string }
        Returns: { day: string; finished: boolean; kind: string; total: number }[]
      }
      challenge_record: {
        Args: { p_challenge_id: string; p_coins: number; p_game_id: string; p_met: boolean; p_user_id: string; p_value: number }
        Returns: Json
      }
      challenge_pay_due: { Args: { p_user_id: string }; Returns: Json }
      challenge_first_run: { Args: { p_deal_key: string; p_user_id: string }; Returns: boolean }
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
      shop_record_days: { Args: { p_days: Json }; Returns: number }
      shop_record_week: {
        Args: { p_bundle_id: string; p_items: string[]; p_name: string; p_price: number; p_week: string }
        Returns: undefined
      }
      pass_credit_joules: { Args: { p_epoch: number; p_rows: Json; p_season: string; p_user_id: string }; Returns: Json }
      pass_state: { Args: { p_epoch: number; p_season: string; p_user_id: string }; Returns: Json }
      pass_joules_since: { Args: { p_epoch: number; p_season: string; p_since: string; p_user_id: string }; Returns: number }
      pass_member_reset: { Args: { p_season: string; p_user_id: string }; Returns: string | null }
      pass_note_level: {
        Args: { p_epoch: number; p_level: number; p_season: string; p_seen: boolean; p_user_id: string }
        Returns: number | null
      }
      pass_record_claim: {
        Args: { p_epoch: number; p_level: number; p_reward: Json; p_season: string; p_track: string; p_user_id: string }
        Returns: string
      }
      pass_grant_premium: { Args: { p_key: string; p_season: string; p_source: string; p_user_id: string }; Returns: string }
      pass_unlock_title: { Args: { p_season: string; p_title: string; p_user_id: string }; Returns: string }
      pass_titles_of: { Args: { p_user_id: string }; Returns: string[] }
      pass_record_week: { Args: { p_easy: string; p_hard: string; p_medium: string; p_week: string }; Returns: undefined }
      pass_activity: { Args: { p_from: string; p_to: string; p_user_id: string }; Returns: Json }
      pass_games_before: { Args: { p_before: string; p_user_id: string }; Returns: string[] }
      shop_is_tester: { Args: { p_user_id: string }; Returns: boolean }
      shop_wishlist_set: { Args: { p_item_id: string; p_on: boolean; p_user_id: string }; Returns: string }
      shop_purchase_bundle: {
        Args: { p_bundle_id: string; p_items: string[]; p_key: string; p_prices: number[]; p_user_id: string; p_week: string }
        Returns: Json
      }
      shop_test_pack: { Args: { p_key: string; p_pack: string; p_user_id: string }; Returns: Json }
      async_board_open: { Args: { p_room_id: string }; Returns: boolean }
      disband_stale_room: { Args: { p_room_id: string }; Returns: boolean }
      mm_purge_practice_deals: { Args: Record<PropertyKey, never>; Returns: number }
      mm_is_tester: { Args: { p_user_id: string }; Returns: boolean }
      mm_queue_claim: {
        Args: { p_choice: string; p_format: string; p_match: string; p_users: string[] }
        Returns: boolean
      }
      mm_run_use: {
        Args: { p_day_start: string; p_key: string; p_match: string; p_max: number; p_viewer: string }
        Returns: boolean
      }
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
          p_duel_id: string | null
          p_message_id: string | null
          p_message_text: string | null
          p_reason: string
          p_reported_name: string | null
          p_reported_user_id: string | null
          p_reporter_user_id: string
        }
        Returns: Json
      }
      friends_search: { Args: { p_user: string; p_query: string; p_limit: number }; Returns: Json }
      friends_send_request: { Args: { p_from: string; p_to: string; p_via: string; p_cap: number }; Returns: Json }
      friends_respond: { Args: { p_user: string; p_request: string; p_accept: boolean; p_cap: number }; Returns: Json }
      friends_remove: { Args: { p_user: string; p_friend: string }; Returns: boolean }
      friends_block: { Args: { p_user: string; p_target: string }; Returns: Json }
      friends_unblock: { Args: { p_user: string; p_target: string }; Returns: boolean }
      friends_invite_token: { Args: { p_user: string; p_token: string; p_reset: boolean }; Returns: string | null }
      friends_link_owner: { Args: { p_token: string }; Returns: Json }
      friends_set_show_online: { Args: { p_user: string; p_show: boolean | null }; Returns: boolean }
      friends_presence_beat: { Args: { p_user: string; p_activity: string }; Returns: boolean }
      friends_room_invite: { Args: { p_from: string; p_to: string }; Returns: Json }
      friends_challenge_send: { Args: { p_from: string; p_to: string; p_code: string }; Returns: Json }
      friends_are_friends: { Args: { p_a: string; p_b: string }; Returns: boolean }
      friends_head_to_head: { Args: { p_a: string; p_b: string }; Returns: Json }
      friends_overview: { Args: { p_user: string; p_cap: number }; Returns: Json }
      friends_waiting: { Args: { p_user: string }; Returns: number }
      friends_profile: { Args: { p_viewer: string; p_target: string }; Returns: Json }
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
      push_log_retention: { Args: Record<PropertyKey, never>; Returns: number }
      push_claim_friend_events: {
        Args: { p_limit: number; p_since: string }
        Returns: {
          actor_id: string
          created_at: string
          id: number
          kind: string
          payload: Json
          recipient_id: string
        }[]
      }
      push_reserve: {
        Args: {
          p_cap: number
          p_counts_cap: boolean
          p_dedupe_key: string | null
          p_event: string
          p_since: string
          p_user_id: string
        }
        Returns: string
      }
      push_streak_candidates: {
        Args: { p_day: string }
        Returns: {
          time_zone: string | null
          user_id: string
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
      tournament_ensure_event: { Args: { p_id: string; p_kind: string; p_title: string; p_pick: string; p_starts: string; p_ends: string }; Returns: undefined }
      tournament_set_status: { Args: { p_event: string; p_from: string[]; p_to: string }; Returns: boolean }
      tournament_set_room: { Args: { p_event: string; p_room: string }; Returns: string | null }
      tournament_enter: { Args: { p_event: string; p_user_id: string; p_entry: string; p_coins: number }; Returns: Json }
      tournament_cancel: { Args: { p_event: string; p_reason: string }; Returns: Json }
      tournament_remind: { Args: { p_event: string; p_user_id: string; p_on: boolean }; Returns: boolean }
      tournament_mark_reminded: { Args: { p_event: string; p_users: string[] }; Returns: number }
      tournament_arena_join: { Args: { p_event: string; p_user_id: string; p_rating: number }; Returns: string }
      tournament_arena_leave: { Args: { p_event: string; p_user_id: string }; Returns: undefined }
      tournament_arena_pair: { Args: { p_event: string; p_a: string; p_b: string; p_duel: string }; Returns: boolean }
      tournament_arena_set_room: { Args: { p_duel: string; p_room: string }; Returns: undefined }
      tournament_arena_void: { Args: { p_duel: string }; Returns: boolean }
      tournament_arena_settle: { Args: { p_duel: string; p_winner: string; p_a_score: number; p_b_score: number; p_games: Json }; Returns: Json }
      tournament_finish: { Args: { p_event: string; p_rows: Json }; Returns: boolean }
      tournament_flag: { Args: { p_event: string; p_player: string; p_source: string; p_source_id: string; p_game_idx: number; p_game: string; p_reason: string }; Returns: boolean }
      tournament_flagged_players: { Args: { p_event: string }; Returns: string[] }
      tournament_pay_prize: { Args: { p_event: string; p_user_id: string; p_place: number; p_coins: number; p_medal: string | null; p_title: string | null }; Returns: Json }
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
