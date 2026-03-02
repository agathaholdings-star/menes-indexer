import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "料金プラン",
  description: "メンエスSKRの会員プラン。無料会員・スタンダード・VIPの3プラン。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
