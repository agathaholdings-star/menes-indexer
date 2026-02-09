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
          parent_group: string | null
          prefecture_id: number
          salon_count: number | null
          search_volume: number | null
          seo_description: string | null
          seo_keyword: string | null
          seo_title: string | null
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
          parent_group?: string | null
          prefecture_id: number
          salon_count?: number | null
          search_volume?: number | null
          seo_description?: string | null
          seo_keyword?: string | null
          seo_title?: string | null
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
          parent_group?: string | null
          prefecture_id?: number
          salon_count?: number | null
          search_volume?: number | null
          seo_description?: string | null
          seo_keyword?: string | null
          seo_title?: string | null
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
          id: string
          membership_type: string | null
          monthly_review_count: number | null
          monthly_review_reset_at: string | null
          nickname: string | null
          payment_customer_id: string | null
          payment_provider: string | null
          total_review_count: number | null
          view_permission_until: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          membership_type?: string | null
          monthly_review_count?: number | null
          monthly_review_reset_at?: string | null
          nickname?: string | null
          payment_customer_id?: string | null
          payment_provider?: string | null
          total_review_count?: number | null
          view_permission_until?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          membership_type?: string | null
          monthly_review_count?: number | null
          monthly_review_reset_at?: string | null
          nickname?: string | null
          payment_customer_id?: string | null
          payment_provider?: string | null
          total_review_count?: number | null
          view_permission_until?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body_type: string | null
          comment_advice: string | null
          comment_first_impression: string | null
          comment_service: string | null
          comment_service_detail: string | null
          created_at: string | null
          id: string
          is_verified: boolean | null
          looks_type: string | null
          param_conversation: number | null
          param_distance: number | null
          param_personality: number | null
          param_technique: number | null
          score: number | null
          service_level: string | null
          shop_id: number
          therapist_id: number
          user_id: string
        }
        Insert: {
          body_type?: string | null
          comment_advice?: string | null
          comment_first_impression?: string | null
          comment_service?: string | null
          comment_service_detail?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          looks_type?: string | null
          param_conversation?: number | null
          param_distance?: number | null
          param_personality?: number | null
          param_technique?: number | null
          score?: number | null
          service_level?: string | null
          shop_id: number
          therapist_id: number
          user_id: string
        }
        Update: {
          body_type?: string | null
          comment_advice?: string | null
          comment_first_impression?: string | null
          comment_service?: string | null
          comment_service_detail?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          looks_type?: string | null
          param_conversation?: number | null
          param_distance?: number | null
          param_personality?: number | null
          param_technique?: number | null
          score?: number | null
          service_level?: string | null
          shop_id?: number
          therapist_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
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
      shop_areas: {
        Row: {
          area_id: number
          display_order: number | null
          is_primary: boolean | null
          shop_id: number
        }
        Insert: {
          area_id: number
          display_order?: number | null
          is_primary?: boolean | null
          shop_id: number
        }
        Update: {
          area_id?: number
          display_order?: number | null
          is_primary?: boolean | null
          shop_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_areas_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          access: string | null
          base_duration: number | null
          base_price: number | null
          business_hours: string | null
          business_type: string | null
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
          search_volume: number | null
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
          search_volume?: number | null
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
          search_volume?: number | null
          seo_title?: string | null
          service_tags?: string[] | null
          slug?: string | null
          source?: string | null
          source_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
          image_urls: Json | null
          last_scraped_at: string | null
          name: string
          profile_text: string | null
          shop_id: number
          slug: string | null
          source_url: string | null
          stats: Json | null
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
          image_urls?: Json | null
          last_scraped_at?: string | null
          name: string
          profile_text?: string | null
          shop_id: number
          slug?: string | null
          source_url?: string | null
          stats?: Json | null
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
          image_urls?: Json | null
          last_scraped_at?: string | null
          name?: string
          profile_text?: string | null
          shop_id?: number
          slug?: string | null
          source_url?: string | null
          stats?: Json | null
          status?: string | null
          updated_at?: string | null
          waist?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "therapists_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      user_rewards: {
        Row: {
          discount_amount: number | null
          id: number
          review_count: number | null
          status: string | null
          target_month: string
          user_id: string
        }
        Insert: {
          discount_amount?: number | null
          id?: never
          review_count?: number | null
          status?: string | null
          target_month: string
          user_id: string
        }
        Update: {
          discount_amount?: number | null
          id?: never
          review_count?: number | null
          status?: string | null
          target_month?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

// 便利な型エイリアス
export type Prefecture = Database["public"]["Tables"]["prefectures"]["Row"];
export type Area = Database["public"]["Tables"]["areas"]["Row"];
export type Shop = Database["public"]["Tables"]["shops"]["Row"];
export type ShopArea = Database["public"]["Tables"]["shop_areas"]["Row"];
export type Therapist = Database["public"]["Tables"]["therapists"]["Row"];
export type Review = Database["public"]["Tables"]["reviews"]["Row"];

