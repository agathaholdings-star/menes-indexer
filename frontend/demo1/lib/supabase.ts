import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// サーバーコンポーネント・クライアントコンポーネント共用
// （認証不要の公開データ読み取り用）
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
