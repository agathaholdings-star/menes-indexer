import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "料金プラン",
  description: "メンエスSKRの料金プラン。サイト公開キャンペーン中は口コミ投稿で全機能が使えます。",
  alternates: { canonical: "/pricing" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
