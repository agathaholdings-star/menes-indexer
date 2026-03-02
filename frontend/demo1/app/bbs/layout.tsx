import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "掲示板",
  description: "メンズエステについて語る掲示板。",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
