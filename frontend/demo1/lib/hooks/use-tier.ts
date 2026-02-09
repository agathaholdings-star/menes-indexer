"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { type User, type EffectiveTier, getEffectiveTier, tierPermissions } from "@/lib/data";

export function useTier() {
  const { user: authUser } = useAuth();
  const [membershipType, setMembershipType] = useState<string>("free");
  const [monthlyReviewCount, setMonthlyReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser) { setLoading(false); return; }
    const supabase = createSupabaseBrowser();
    supabase
      .from("profiles")
      .select("membership_type, monthly_review_count")
      .eq("id", authUser.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setMembershipType(data.membership_type || "free");
          setMonthlyReviewCount(data.monthly_review_count || 0);
        }
        setLoading(false);
      });
  }, [authUser]);

  const tierUser: User = {
    id: authUser?.id || "",
    email: authUser?.email || "",
    name: "",
    memberType: membershipType as "free" | "standard" | "vip",
    monthlyReviewCount,
    totalReviewCount: 0,
    registeredAt: "",
    favorites: [],
  };

  const effectiveTier: EffectiveTier = authUser ? getEffectiveTier(tierUser) : "free";
  const permissions = tierPermissions[effectiveTier];

  return { effectiveTier, permissions, loading, authUser };
}
