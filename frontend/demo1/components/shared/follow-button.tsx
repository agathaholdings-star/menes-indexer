"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth-context";

interface FollowButtonProps {
  userId: string;
  userName?: string;
  size?: "sm" | "md";
}

export function FollowButton({
  userId,
  userName,
  size = "sm",
}: FollowButtonProps) {
  const { user, loading: authLoading } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Self check: hide if viewing own profile
  const isSelf = user?.id === userId;

  const checkFollowStatus = useCallback(async () => {
    if (!user || isSelf) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/user-follows?user_ids=${encodeURIComponent(userId)}`
      );
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(!!data[userId]);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [user, userId, isSelf]);

  useEffect(() => {
    if (authLoading) return;
    checkFollowStatus();
  }, [authLoading, checkFollowStatus]);

  const handleToggle = async () => {
    if (!user) return;

    // Optimistic update
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    try {
      const res = await fetch("/api/user-follows", {
        method: wasFollowing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followed_id: userId }),
      });
      if (!res.ok) {
        // Revert on failure
        setIsFollowing(wasFollowing);
      }
    } catch {
      setIsFollowing(wasFollowing);
    }
  };

  // Don't render for self
  if (isSelf) return null;

  // Don't render while auth is loading
  if (authLoading) return null;

  // Sizing
  const sizeClasses =
    size === "sm" ? "h-7 px-2 text-xs gap-1" : "h-9 px-3 text-sm gap-1.5";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  // Not logged in: show disabled with tooltip
  if (!user) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="ghost"
              disabled
              className={`${sizeClasses} text-muted-foreground`}
            >
              <UserPlus className={iconSize} />
              <span>フォロー</span>
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>ログインが必要です</TooltipContent>
      </Tooltip>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Button
        variant="ghost"
        disabled
        className={`${sizeClasses} text-muted-foreground`}
      >
        <UserPlus className={iconSize} />
        <span>フォロー</span>
      </Button>
    );
  }

  const button = (
    <Button
      variant="ghost"
      onClick={handleToggle}
      className={`${sizeClasses} ${
        isFollowing
          ? "text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary"
          : "text-muted-foreground hover:text-primary"
      }`}
    >
      {isFollowing ? (
        <UserCheck className={iconSize} />
      ) : (
        <UserPlus className={iconSize} />
      )}
      <span>{isFollowing ? "フォロー中" : "フォロー"}</span>
    </Button>
  );

  if (userName) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          {isFollowing
            ? `${userName}のフォローを解除`
            : `${userName}をフォロー`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
