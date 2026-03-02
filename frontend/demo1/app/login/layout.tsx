import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "ログイン",
  description: "メンエスSKRにログイン。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
