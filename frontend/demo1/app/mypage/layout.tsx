import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "マイページ",
  description: "あなたの口コミ・嗜好マップ・反響ダッシュボードを確認。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
