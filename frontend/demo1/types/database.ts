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
      areas: {
        Row: {
          created_at: string | null
          data_source_url: string | null
          id: number
          meta_description: string | null
          name: string
          nearby_areas: string | null
          prefecture_id: number
          salon_count: number | null
          search_volume: number | null
          seo_description: string | null
          seo_keyword: string | null
          slug: string
          source_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_source_url?: string | null
          id?: never
          meta_description?: string | null
          name: string
          nearby_areas?: string | null
          prefecture_id: number
          salon_count?: number | null
          search_volume?: number | null
          seo_description?: string | null
          seo_keyword?: string | null
          slug: string
          source_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_source_url?: string | null
          id?: never
          meta_description?: string | null
          name?: string
          nearby_areas?: string | null
          prefecture_id?: number
          salon_count?: number | null
          search_volume?: number | null
          seo_description?: string | null
          seo_keyword?: string | null
          slug?: string
          source_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "areas_prefecture_id_fkey"
            columns: ["prefecture_id"]
            isOneToOne: false
            referencedRelation: "prefectures"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      body_types: {
        Row: {
          id: number
          label: string
        }
        Insert: {
          id: number
          label: string
        }
        Update: {
          id?: number
          label?: string
        }
        Relationships: []
      }
      cup_types: {
        Row: {
          id: number
          label: string
        }
        Insert: {
          id: number
          label: string
        }
        Update: {
          id?: number
          label?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string | null
          therapist_id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          therapist_id: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          therapist_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      looks_types: {
        Row: {
          id: number
          label: string
        }
        Insert: {
          id: number
          label: string
        }
        Update: {
          id?: number
          label?: string
        }
        Relationships: []
      }
      missing_therapist_reports: {
        Row: {
          created_at: string | null
          id: number
          reviewed_at: string | null
          salon_id: number | null
          status: string
          therapist_name: string
        }
        Insert: {
          created_at?: string | null
          id?: never
          reviewed_at?: string | null
          salon_id?: number | null
          status?: string
          therapist_name: string
        }
        Update: {
          created_at?: string | null
          id?: never
          reviewed_at?: string | null
          salon_id?: number | null
          status?: string
          therapist_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "missing_therapist_reports_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_review_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "missing_therapist_reports_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: number
          is_read: boolean | null
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: never
          is_read?: boolean | null
          link?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: never
          is_read?: boolean | null
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prefectures: {
        Row: {
          display_order: number | null
          id: number
          name: string
          region: string | null
          slug: string
        }
        Insert: {
          display_order?: number | null
          id: number
          name: string
          region?: string | null
          slug: string
        }
        Update: {
          display_order?: number | null
          id?: number
          name?: string
          region?: string | null
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          follower_count: number | null
          id: string
          is_admin: boolean
          membership_type: string | null
          monthly_review_count: number | null
          monthly_review_reset_at: string | null
          nickname: string | null
          payment_customer_id: string | null
          payment_provider: string | null
          review_credits: number
          total_review_count: number | null
          view_permission_until: string | null
          credits_expires_at: string | null
        }
        Insert: {
          created_at?: string | null
          follower_count?: number | null
          id: string
          is_admin?: boolean
          membership_type?: string | null
          monthly_review_count?: number | null
          monthly_review_reset_at?: string | null
          nickname?: string | null
          payment_customer_id?: string | null
          payment_provider?: string | null
          review_credits?: number
          total_review_count?: number | null
          view_permission_until?: string | null
          credits_expires_at?: string | null
        }
        Update: {
          created_at?: string | null
          follower_count?: number | null
          id?: string
          is_admin?: boolean
          membership_type?: string | null
          monthly_review_count?: number | null
          monthly_review_reset_at?: string | null
          nickname?: string | null
          payment_customer_id?: string | null
          payment_provider?: string | null
          review_credits?: number
          total_review_count?: number | null
          view_permission_until?: string | null
          credits_expires_at?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string | null
          detail: string | null
          id: number
          reason: string
          reporter_id: string
          reviewed_at: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string | null
          detail?: string | null
          id?: never
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string | null
          detail?: string | null
          id?: never
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_helpful: {
        Row: {
          created_at: string | null
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_helpful_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_votes: {
        Row: {
          created_at: string | null
          review_id: string
          updated_at: string | null
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string | null
          review_id: string
          updated_at?: string | null
          user_id: string
          vote_type: string
        }
        Update: {
          created_at?: string | null
          review_id?: string
          updated_at?: string | null
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body_type_id: number | null
          comment_advice: string | null
          comment_cost: string | null
          comment_first_impression: string | null
          comment_reason: string | null
          comment_revisit: string | null
          comment_service: string | null
          comment_service_detail: string | null
          comment_style: string | null
          cost_total: number | null
          created_at: string | null
          cup_type_id: number | null
          fake_count: number
          helpful_count: number | null
          id: string
          is_seed: boolean
          is_verified: boolean | null
          looks_type_id: number | null
          moderation_status: string
          param_conversation: number | null
          param_distance: number | null
          param_personality: number | null
          param_technique: number | null
          real_count: number
          salon_id: number
          score: number | null
          service_level_id: number | null
          therapist_id: number
          user_id: string | null
          verification_image_path: string | null
          view_count: number
          rejection_reason: string | null
        }
        Insert: {
          body_type_id?: number | null
          comment_advice?: string | null
          comment_cost?: string | null
          comment_first_impression?: string | null
          comment_reason?: string | null
          comment_revisit?: string | null
          comment_service?: string | null
          comment_service_detail?: string | null
          comment_style?: string | null
          cost_total?: number | null
          created_at?: string | null
          cup_type_id?: number | null
          fake_count?: number
          helpful_count?: number | null
          id?: string
          is_seed?: boolean
          is_verified?: boolean | null
          looks_type_id?: number | null
          moderation_status?: string
          param_conversation?: number | null
          param_distance?: number | null
          param_personality?: number | null
          param_technique?: number | null
          real_count?: number
          salon_id: number
          score?: number | null
          service_level_id?: number | null
          therapist_id: number
          user_id?: string | null
          verification_image_path?: string | null
          view_count?: number
          rejection_reason?: string | null
        }
        Update: {
          body_type_id?: number | null
          comment_advice?: string | null
          comment_cost?: string | null
          comment_first_impression?: string | null
          comment_reason?: string | null
          comment_revisit?: string | null
          comment_service?: string | null
          comment_service_detail?: string | null
          comment_style?: string | null
          cost_total?: number | null
          created_at?: string | null
          cup_type_id?: number | null
          fake_count?: number
          helpful_count?: number | null
          id?: string
          is_seed?: boolean
          is_verified?: boolean | null
          looks_type_id?: number | null
          moderation_status?: string
          param_conversation?: number | null
          param_distance?: number | null
          param_personality?: number | null
          param_technique?: number | null
          real_count?: number
          salon_id?: number
          score?: number | null
          service_level_id?: number | null
          therapist_id?: number
          user_id?: string | null
          verification_image_path?: string | null
          view_count?: number
          rejection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_body_type_id_fkey"
            columns: ["body_type_id"]
            isOneToOne: false
            referencedRelation: "body_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_cup_type_id_fkey"
            columns: ["cup_type_id"]
            isOneToOne: false
            referencedRelation: "cup_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_looks_type_id_fkey"
            columns: ["looks_type_id"]
            isOneToOne: false
            referencedRelation: "looks_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_review_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "reviews_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_service_level_id_fkey"
            columns: ["service_level_id"]
            isOneToOne: false
            referencedRelation: "service_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_areas: {
        Row: {
          area_id: number
          display_order: number | null
          is_primary: boolean | null
          salon_id: number
        }
        Insert: {
          area_id: number
          display_order?: number | null
          is_primary?: boolean | null
          salon_id: number
        }
        Update: {
          area_id?: number
          display_order?: number | null
          is_primary?: boolean | null
          salon_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "salon_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salon_areas_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_review_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "salon_areas_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salons: {
        Row: {
          access: string | null
          base_duration: number | null
          base_price: number | null
          business_hours: string | null
          business_type: string | null
          cms_fingerprint: string | null
          created_at: string | null
          description: string | null
          display_name: string | null
          domain: string | null
          id: number
          image_url: string | null
          is_active: boolean | null
          last_scraped_at: string | null
          name: string
          official_url: string | null
          phone: string | null
          salon_overview: string | null
          seo_title: string | null
          service_tags: string[] | null
          slug: string | null
          source: string | null
          source_id: string | null
          updated_at: string | null
        }
        Insert: {
          access?: string | null
          base_duration?: number | null
          base_price?: number | null
          business_hours?: string | null
          business_type?: string | null
          cms_fingerprint?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          domain?: string | null
          id?: never
          image_url?: string | null
          is_active?: boolean | null
          last_scraped_at?: string | null
          name: string
          official_url?: string | null
          phone?: string | null
          salon_overview?: string | null
          seo_title?: string | null
          service_tags?: string[] | null
          slug?: string | null
          source?: string | null
          source_id?: string | null
          updated_at?: string | null
        }
        Update: {
          access?: string | null
          base_duration?: number | null
          base_price?: number | null
          business_hours?: string | null
          business_type?: string | null
          cms_fingerprint?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          domain?: string | null
          id?: never
          image_url?: string | null
          is_active?: boolean | null
          last_scraped_at?: string | null
          name?: string
          official_url?: string | null
          phone?: string | null
          salon_overview?: string | null
          seo_title?: string | null
          service_tags?: string[] | null
          slug?: string | null
          source?: string | null
          source_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      service_levels: {
        Row: {
          id: number
          label: string
        }
        Insert: {
          id: number
          label: string
        }
        Update: {
          id?: number
          label?: string
        }
        Relationships: []
      }
      therapist_unlocks: {
        Row: {
          therapist_id: number
          unlocked_at: string
          user_id: string
          is_permanent: boolean
        }
        Insert: {
          therapist_id: number
          unlocked_at?: string
          user_id: string
          is_permanent?: boolean
        }
        Update: {
          therapist_id?: number
          unlocked_at?: string
          user_id?: string
          is_permanent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "therapist_unlocks_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_unlocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      therapists: {
        Row: {
          age: number | null
          bust: string | null
          created_at: string | null
          cup: string | null
          height: number | null
          hip: number | null
          id: number
          image_status: string | null
          image_urls: Json | null
          last_scraped_at: string | null
          name: string
          person_id: number | null
          profile_text: string | null
          salon_id: number
          slug: string | null
          source_url: string | null
          status: string | null
          updated_at: string | null
          waist: number | null
        }
        Insert: {
          age?: number | null
          bust?: string | null
          created_at?: string | null
          cup?: string | null
          height?: number | null
          hip?: number | null
          id?: never
          image_status?: string | null
          image_urls?: Json | null
          last_scraped_at?: string | null
          name: string
          person_id?: number | null
          profile_text?: string | null
          salon_id: number
          slug?: string | null
          source_url?: string | null
          status?: string | null
          updated_at?: string | null
          waist?: number | null
        }
        Update: {
          age?: number | null
          bust?: string | null
          created_at?: string | null
          cup?: string | null
          height?: number | null
          hip?: number | null
          id?: never
          image_status?: string | null
          image_urls?: Json | null
          last_scraped_at?: string | null
          name?: string
          person_id?: number | null
          profile_text?: string | null
          salon_id?: number
          slug?: string | null
          source_url?: string | null
          status?: string | null
          updated_at?: string | null
          waist?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "therapists_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_review_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "therapists_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string | null
          followed_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string | null
          followed_id: string
          follower_id: string
        }
        Update: {
          created_at?: string | null
          followed_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          device_fingerprint: string
          device_label: string | null
          id: string
          ip_address: unknown
          is_active: boolean | null
          last_active_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_fingerprint: string
          device_label?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_active_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_fingerprint?: string
          device_label?: string | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          last_active_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      salon_review_stats: {
        Row: {
          avg_score: number | null
          latest_review_at: string | null
          review_count: number | null
          salon_id: number | null
          sum_score: number | null
          therapist_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_review: { Args: { review_id: string }; Returns: undefined }
      get_profile_with_reset: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          id: string
          is_admin: boolean
          membership_type: string
          monthly_review_count: number
          monthly_review_reset_at: string
          nickname: string
          review_credits: number
          total_review_count: number
          view_permission_until: string
          credits_expires_at: string
        }[]
      }
      get_ranked_salons_by_area: {
        Args: { p_area_id: number; p_limit?: number }
        Returns: {
          avg_score: number
          bayesian_score: number
          latest_review_at: string
          ranking_score: number
          review_count: number
          salon_id: number
          therapist_count: number
        }[]
      }
      get_salon_review_stats_batch: {
        Args: { p_salon_ids: number[] }
        Returns: {
          avg_score: number
          review_count: number
          salon_id: number
          therapist_count: number
        }[]
      }
      increment_review_views: {
        Args: { p_review_ids: string[] }
        Returns: undefined
      }
      reject_review: {
        Args: { review_id: string; p_reason?: string }
        Returns: undefined
      }
      is_therapist_unlocked: {
        Args: { p_therapist_id: number }
        Returns: boolean
      }
      unlock_therapist: { Args: { p_therapist_id: number }; Returns: boolean }
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
