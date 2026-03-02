import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "通知",
  description: "あなたへの通知一覧。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
