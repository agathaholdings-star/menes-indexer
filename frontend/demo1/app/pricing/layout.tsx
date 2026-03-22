import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "料金プラン",
  description: "メンエスSKRの料金プラン。口コミ投稿で全機能が無料で使えます。",
  alternates: { canonical: "/pricing" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
