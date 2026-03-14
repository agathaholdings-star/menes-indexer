"use client";

import { useState, useEffect, type ReactNode } from "react";

interface HydrationSwitchProps {
  /** Content shown during SSR and before hydration (visible to crawlers) */
  ssrContent: ReactNode;
  /** Interactive content shown after client hydration */
  children: ReactNode;
}

/**
 * Shows SSR content on initial render (server + pre-hydration),
 * then switches to client children after hydration.
 * Googlebot (which typically doesn't execute JS) sees the SSR content.
 */
export function HydrationSwitch({ ssrContent, children }: HydrationSwitchProps) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return <>{ssrContent}</>;
  }

  return <>{children}</>;
}
