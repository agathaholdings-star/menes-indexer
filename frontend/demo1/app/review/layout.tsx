import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "口コミを書く",
  description: "メンズエステの口コミ・体験レポートを投稿。投稿すると10人分のセラピスト口コミが読めます。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
