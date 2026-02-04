"use client";

import { useState, createContext, useContext, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type MemberLevel = "free" | "standard" | "vip";

interface MemberLevelContextType {
  level: MemberLevel;
  setLevel: (level: MemberLevel) => void;
  isFree: boolean;
  isStandard: boolean;
  isVip: boolean;
}

const MemberLevelContext = createContext<MemberLevelContextType | null>(null);

export function useMemberLevel() {
  const context = useContext(MemberLevelContext);
  if (!context) {
    return {
      level: "free" as MemberLevel,
      setLevel: () => {},
      isFree: true,
      isStandard: false,
      isVip: false,
    };
  }
  return context;
}

export function MemberLevelProvider({ children }: { children: ReactNode }) {
  const [level, setLevel] = useState<MemberLevel>("free");

  return (
    <MemberLevelContext.Provider
      value={{
        level,
        setLevel,
        isFree: level === "free",
        isStandard: level === "standard",
        isVip: level === "vip",
      }}
    >
      {children}
    </MemberLevelContext.Provider>
  );
}

export function MemberLevelDebug() {
  const { level, setLevel } = useMemberLevel();

  return (
    <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-primary">デバッグ: 会員レベル切替</p>
          <p className="text-sm text-muted-foreground">
            各会員レベルでの表示を確認できます
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={level === "free" ? "default" : "outline"}
            onClick={() => setLevel("free")}
          >
            無料
          </Button>
          <Button
            size="sm"
            variant={level === "standard" ? "default" : "outline"}
            onClick={() => setLevel("standard")}
          >
            スタンダード
          </Button>
          <Button
            size="sm"
            variant={level === "vip" ? "default" : "outline"}
            onClick={() => setLevel("vip")}
          >
            VIP
          </Button>
        </div>
      </div>
    </div>
  );
}
