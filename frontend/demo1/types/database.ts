export interface Database {
  public: {
    Tables: {
      prefectures: {
        Row: {
          id: number;
          name: string;
          slug: string;
          region: string | null;
          display_order: number | null;
        };
      };
      areas: {
        Row: {
          id: number;
          prefecture_id: number;
          name: string;
          slug: string;
          seo_keyword: string | null;
          seo_title: string | null;
          seo_description: string | null;
          meta_description: string | null;
          search_volume: number | null;
          source_type: string | null;
          data_source_url: string | null;
          parent_group: string | null;
          nearby_areas: string | null;
          salon_count: number;
          created_at: string;
          updated_at: string;
        };
      };
      shops: {
        Row: {
          id: number;
          source_id: string | null;
          name: string;
          display_name: string | null;
          slug: string | null;
          seo_title: string | null;
          salon_overview: string | null;
          business_type: string | null;
          access: string | null;
          business_hours: string | null;
          base_price: number | null;
          base_duration: number | null;
          phone: string | null;
          official_url: string | null;
          domain: string | null;
          description: string | null;
          service_tags: string[];
          image_url: string | null;
          search_volume: number | null;
          source: string | null;
          is_active: boolean;
          last_scraped_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      shop_areas: {
        Row: {
          shop_id: number;
          area_id: number;
          is_primary: boolean;
          display_order: number;
        };
      };
      therapists: {
        Row: {
          id: number;
          shop_id: number;
          name: string;
          slug: string | null;
          age: number | null;
          height: number | null;
          bust: string | null;
          waist: number | null;
          hip: number | null;
          cup: string | null;
          image_urls: string[] | null;
          profile_text: string | null;
          source_url: string | null;
          status: string;
          stats: Record<string, unknown> | null;
          last_scraped_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          therapist_id: number;
          shop_id: number;
          looks_type: string | null;
          body_type: string | null;
          service_level: string | null;
          param_conversation: number | null;
          param_distance: number | null;
          param_technique: number | null;
          param_personality: number | null;
          score: number | null;
          comment_first_impression: string | null;
          comment_service: string | null;
          comment_advice: string | null;
          comment_service_detail: string | null;
          is_verified: boolean;
          created_at: string;
        };
      };
    };
  };
}

// 便利な型エイリアス
export type Prefecture = Database["public"]["Tables"]["prefectures"]["Row"];
export type Area = Database["public"]["Tables"]["areas"]["Row"];
export type Shop = Database["public"]["Tables"]["shops"]["Row"];
export type ShopArea = Database["public"]["Tables"]["shop_areas"]["Row"];
export type Therapist = Database["public"]["Tables"]["therapists"]["Row"];
export type Review = Database["public"]["Tables"]["reviews"]["Row"];
