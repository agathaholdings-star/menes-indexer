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
      bbs_post_likes: {
        Row: {
          created_at: string | null
          post_id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          post_id: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          post_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bbs_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "bbs_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bbs_post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bbs_posts: {
        Row: {
          body: string
          created_at: string | null
          id: number
          likes: number | null
          thread_id: number
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: never
          likes?: number | null
          thread_id: number
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: never
          likes?: number | null
          thread_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bbs_posts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "bbs_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bbs_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bbs_threads: {
        Row: {
          body: string
          category: string
          created_at: string | null
          id: number
          is_locked: boolean | null
          is_pinned: boolean | null
          is_vip_only: boolean
          last_reply_at: string | null
          reply_count: number | null
          title: string
          updated_at: string | null
          user_id: string
          view_count: number | null
        }
        Insert: {
          body: string
          category?: string
          created_at?: string | null
          id?: never
          is_locked?: boolean | null
          is_pinned?: boolean | null
          is_vip_only?: boolean
          last_reply_at?: string | null
          reply_count?: number | null
          title: string
          updated_at?: string | null
          user_id: string
          view_count?: number | null
        }
        Update: {
          body?: string
          category?: string
          created_at?: string | null
          id?: never
          is_locked?: boolean | null
          is_pinned?: boolean | null
          is_vip_only?: boolean
          last_reply_at?: string | null
          reply_count?: number | null
          title?: string
          updated_at?: string | null
          user_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bbs_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      cms_patterns: {
        Row: {
          ajax_pagination: Json
          cms_name: string
          confidence: number
          created_at: string | null
          fail_count: number
          fingerprint: Json
          id: number
          list_data_rules: Json
          list_url_rules: Json
          success_count: number
          therapist_data_rules: Json
          therapist_list_rules: Json
          updated_at: string | null
          version: number
        }
        Insert: {
          ajax_pagination?: Json
          cms_name: string
          confidence?: number
          created_at?: string | null
          fail_count?: number
          fingerprint?: Json
          id?: never
          list_data_rules?: Json
          list_url_rules?: Json
          success_count?: number
          therapist_data_rules?: Json
          therapist_list_rules?: Json
          updated_at?: string | null
          version?: number
        }
        Update: {
          ajax_pagination?: Json
          cms_name?: string
          confidence?: number
          created_at?: string | null
          fail_count?: number
          fingerprint?: Json
          id?: never
          list_data_rules?: Json
          list_url_rules?: Json
          success_count?: number
          therapist_data_rules?: Json
          therapist_list_rules?: Json
          updated_at?: string | null
          version?: number
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          id: number
          last_message_at: string | null
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string | null
          id?: never
          last_message_at?: string | null
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string | null
          id?: never
          last_message_at?: string | null
          user1_id?: string
          user2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      messages: {
        Row: {
          body: string
          conversation_id: number
          created_at: string | null
          id: number
          is_read: boolean | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: number
          created_at?: string | null
          id?: never
          is_read?: boolean | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: number
          created_at?: string | null
          id?: never
          is_read?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
        }
        Insert: {
          created_at?: string | null
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
        }
        Update: {
          created_at?: string | null
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
        }
        Relationships: []
      }
      therapist_unlocks: {
        Row: {
          user_id: string
          therapist_id: number
          unlocked_at: string
        }
        Insert: {
          user_id: string
          therapist_id: number
          unlocked_at?: string
        }
        Update: {
          user_id?: string
          therapist_id?: number
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_unlocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_unlocks_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "reviews_service_level_id_fkey"
            columns: ["service_level_id"]
            isOneToOne: false
            referencedRelation: "service_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_review_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "reviews_shop_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
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
            foreignKeyName: "shop_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_areas_shop_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_review_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "shop_areas_shop_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      salon_scrape_cache: {
        Row: {
          cms_pattern_id: number | null
          created_at: string | null
          extraction_method: string | null
          fail_reason: string | null
          fail_streak: number | null
          last_scraped_at: string | null
          last_therapist_count: number | null
          name_css_selector: string | null
          salon_id: number
          therapist_list_url: string | null
          updated_at: string | null
        }
        Insert: {
          cms_pattern_id?: number | null
          created_at?: string | null
          extraction_method?: string | null
          fail_reason?: string | null
          fail_streak?: number | null
          last_scraped_at?: string | null
          last_therapist_count?: number | null
          name_css_selector?: string | null
          salon_id: number
          therapist_list_url?: string | null
          updated_at?: string | null
        }
        Update: {
          cms_pattern_id?: number | null
          created_at?: string | null
          extraction_method?: string | null
          fail_reason?: string | null
          fail_streak?: number | null
          last_scraped_at?: string | null
          last_therapist_count?: number | null
          name_css_selector?: string | null
          salon_id?: number
          therapist_list_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_scrape_cache_cms_pattern_id_fkey"
            columns: ["cms_pattern_id"]
            isOneToOne: false
            referencedRelation: "cms_patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_scrape_cache_shop_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
            referencedRelation: "salon_review_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "shop_scrape_cache_shop_id_fkey"
            columns: ["salon_id"]
            isOneToOne: true
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
      scrape_log: {
        Row: {
          created_at: string | null
          detail: string | null
          html_hash: string | null
          id: number
          method: string
          salon_id: number
          step: string
          success: boolean
        }
        Insert: {
          created_at?: string | null
          detail?: string | null
          html_hash?: string | null
          id?: never
          method: string
          salon_id: number
          step: string
          success?: boolean
        }
        Update: {
          created_at?: string | null
          detail?: string | null
          html_hash?: string | null
          id?: never
          method?: string
          salon_id?: number
          step?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "scrape_log_shop_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_review_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "scrape_log_shop_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
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
          salon_id: number
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
          salon_id: number
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
          salon_id?: number
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
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salon_review_stats"
            referencedColumns: ["salon_id"]
          },
          {
            foreignKeyName: "therapists_shop_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
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
      reject_review: { Args: { review_id: string }; Returns: undefined }
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

// Custom type aliases for convenience
export type Prefecture = Database["public"]["Tables"]["prefectures"]["Row"];
export type Area = Database["public"]["Tables"]["areas"]["Row"];
export type Salon = Database["public"]["Tables"]["salons"]["Row"];
export type Shop = Salon; // backward compat alias
export type SalonArea = Database["public"]["Tables"]["salon_areas"]["Row"];
export type Therapist = Database["public"]["Tables"]["therapists"]["Row"];
export type Review = Database["public"]["Tables"]["reviews"]["Row"];

