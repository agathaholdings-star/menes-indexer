import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "メンズエステの口コミ・体験談を投稿",
  description: "メンズエステの口コミや体験談を投稿して、他のユーザーの口コミを無料で読もう。1件投稿で5クレジット獲得、5件の口コミが読める。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
