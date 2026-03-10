import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "セラピスト検索",
  description: "メンズエステのセラピストをエリア・タイプ・スタイルで検索。口コミ評価から理想のセラピストを発見。",
  alternates: { canonical: "/search" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
