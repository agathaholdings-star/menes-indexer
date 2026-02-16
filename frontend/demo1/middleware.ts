import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const BOT_UA_PATTERNS = [
  /^$/,
  /curl/i,
  /python/i,
  /scrapy/i,
  /httpx/i,
  /axios/i,
  /node-fetch/i,
  /go-http-client/i,
  /java\//i,
  /wget/i,
  /libwww/i,
  /postman/i,
];

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

// Rate limiter は環境変数が設定されている場合のみ動的にロード
async function checkRateLimit(ip: string, pathname: string): Promise<{ success: boolean; reset?: number }> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { success: true };
  }

  const { apiRateLimit, searchRateLimit, authRateLimit } = await import("@/lib/rate-limit");

  if (pathname.startsWith("/api/therapists") || pathname.startsWith("/api/reviews")) {
    return searchRateLimit.limit(ip);
  }
  if (pathname === "/login" || pathname === "/register" || pathname.startsWith("/api/sessions")) {
    return authRateLimit.limit(ip);
  }
  return apiRateLimit.limit(ip);
}

export async function middleware(request: NextRequest) {
  const ua = request.headers.get("user-agent") || "";

  // Block suspicious user-agents on API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const isBot = BOT_UA_PATTERNS.some((p) => p.test(ua));
    if (isBot) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limiting
    const ip = getClientIp(request);
    const { success, reset } = await checkRateLimit(ip, request.nextUrl.pathname);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(((reset ?? Date.now()) - Date.now()) / 1000)),
          },
        }
      );
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    // 静的ファイル・画像・faviconを除外
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
