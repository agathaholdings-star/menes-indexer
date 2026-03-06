import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "口コミを書く",
  description: "メンズエステの口コミ・体験レポートを投稿。投稿すると5人分のセラピスト口コミが読めます（スクショ付きで10人分）。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
