import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "新規登録",
  description: "メンエスSKRに無料会員登録。口コミ投稿で10人分のセラピスト口コミが読めます。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
