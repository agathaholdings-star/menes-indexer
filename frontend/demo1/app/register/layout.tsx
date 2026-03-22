import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "新規登録",
  description: "メンエスSKRに会員登録。キャンペーン中は口コミ投稿で5人分のセラピスト口コミが読めます（スクショ付きで10人分）。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
