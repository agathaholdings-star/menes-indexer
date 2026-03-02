"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { type User, type EffectiveTier, getEffectiveTier, tierPermissions } from "@/lib/data";

export function useTier() {
  const { user: authUser } = useAuth();
  const [membershipType, setMembershipType] = useState<string>("free");
  const [monthlyReviewCount, setMonthlyReviewCount] = useState(0);
  const [viewPermissionUntil, setViewPermissionUntil] = useState<string | undefined>();
  const [totalReviewCount, setTotalReviewCount] = useState(0);
  const [reviewCredits, setReviewCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser) { setLoading(false); return; }
    const supabase = createSupabaseBrowser();
    // RPC経由で取得（月次リセットが必要なら自動実行される）
    supabase
      .rpc("get_profile_with_reset", { p_user_id: authUser.id })
      .single()
      .then(({ data }) => {
        if (data) {
          setMembershipType(data.membership_type || "free");
          setMonthlyReviewCount(data.monthly_review_count || 0);
          setViewPermissionUntil(data.view_permission_until || undefined);
          setTotalReviewCount(data.total_review_count || 0);
          setReviewCredits(data.review_credits || 0);
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
    viewingExpiry: viewPermissionUntil,
    totalReviewCount,
    reviewCredits,
    registeredAt: "",
    favorites: [],
  };

  const effectiveTier: EffectiveTier = authUser ? getEffectiveTier(tierUser) : "free";
  const permissions = tierPermissions[effectiveTier];

  return {
    effectiveTier,
    permissions,
    loading,
    authUser,
    membershipType,
    monthlyReviewCount,
    viewPermissionUntil,
    totalReviewCount,
    reviewCredits,
    setReviewCredits,
  };
}
