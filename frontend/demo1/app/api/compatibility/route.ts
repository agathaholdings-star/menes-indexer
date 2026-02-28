import { supabaseAdmin } from "@/lib/supabase-admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { therapistTypes, bodyTypes, serviceTypes } from "@/lib/data";

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

interface ReviewRow {
  looks_type_id: number | null;
  body_type_id: number | null;
  service_level_id: number | null;
  param_conversation: number | null;
  param_distance: number | null;
  param_technique: number | null;
  param_personality: number | null;
  score: number | null;
}

interface Distribution {
  id: string;
  count: number;
  percentage: number;
}

interface AvgParams {
  conversation: number;
  distance: number;
  technique: number;
  personality: number;
}

function buildDistribution(rows: ReviewRow[], key: keyof ReviewRow): Distribution[] {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const v = r[key];
    if (v != null) {
      counts[String(v)] = (counts[String(v)] || 0) + 1;
      total++;
    }
  }
  return Object.entries(counts)
    .map(([id, count]) => ({
      id,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function avgParams(rows: ReviewRow[]): AvgParams {
  const avg = (key: keyof ReviewRow) => {
    const vals = rows.map((r) => r[key]).filter((v): v is number => v != null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 3;
  };
  return {
    conversation: avg("param_conversation"),
    distance: avg("param_distance"),
    technique: avg("param_technique"),
    personality: avg("param_personality"),
  };
}

function euclideanDistance(a: AvgParams, b: AvgParams): number {
  return Math.sqrt(
    (a.conversation - b.conversation) ** 2 +
      (a.distance - b.distance) ** 2 +
      (a.technique - b.technique) ** 2 +
      (a.personality - b.personality) ** 2
  );
}

function typeName(id: string): string {
  return therapistTypes.find((t) => t.id === id)?.label || "";
}

function bodyTypeName(id: string): string {
  return bodyTypes.find((t) => t.id === id)?.label || "";
}

interface CompatibilityResult {
  therapistId: string;
  score: number;
  label: string;
  color: string;
  reasons: string[];
  needsMoreReviews: boolean;
}

function calculate(
  userReviews: ReviewRow[],
  therapistReviews: ReviewRow[],
  therapistId: string
): CompatibilityResult {
  if (userReviews.length < 3) {
    return {
      therapistId,
      score: -1,
      label: "",
      color: "",
      reasons: [],
      needsMoreReviews: true,
    };
  }

  if (therapistReviews.length === 0) {
    return {
      therapistId,
      score: -1,
      label: "口コミなし",
      color: "gray",
      reasons: [],
      needsMoreReviews: false,
    };
  }

  // User preference profile
  const userLooks = buildDistribution(userReviews, "looks_type_id");
  const userBody = buildDistribution(userReviews, "body_type_id");
  const userService = buildDistribution(userReviews, "service_level_id");
  const userParams = avgParams(userReviews);

  // Therapist profile (from reviews about them)
  const thLooks = buildDistribution(therapistReviews, "looks_type_id");
  const thBody = buildDistribution(therapistReviews, "body_type_id");
  const thService = buildDistribution(therapistReviews, "service_level_id");
  const thParams = avgParams(therapistReviews);

  // 1. Looks type match (weight 0.35)
  // How much does the user prefer the therapist's dominant type?
  const thTopLooks = thLooks[0]?.id;
  const looksMatch = thTopLooks
    ? userLooks.find((t) => t.id === thTopLooks)?.percentage || 0
    : 0;

  // 2. Parameter similarity (weight 0.30)
  const paramDist = euclideanDistance(userParams, thParams);
  // Max possible distance: sqrt(4 * (5-1)^2) = 8
  const paramMatch = Math.max(0, Math.round(100 - (paramDist / 8) * 100));

  // 3. Body type match (weight 0.20)
  const thTopBody = thBody[0]?.id;
  const bodyMatch = thTopBody
    ? userBody.find((t) => t.id === thTopBody)?.percentage || 0
    : 0;

  // 4. Service level match (weight 0.15)
  const thTopService = thService[0]?.id;
  const serviceMatch = thTopService
    ? userService.find((t) => t.id === thTopService)?.percentage || 0
    : 0;

  const score = Math.round(
    looksMatch * 0.35 + paramMatch * 0.3 + bodyMatch * 0.2 + serviceMatch * 0.15
  );

  // Label & color
  let label: string;
  let color: string;
  if (score >= 70) {
    label = "相性◎";
    color = "green";
  } else if (score >= 45) {
    label = "相性○";
    color = "yellow";
  } else if (score >= 25) {
    label = "相性△";
    color = "gray";
  } else {
    label = "相性？";
    color = "gray";
  }

  // Reasons
  const reasons: string[] = [];
  if (thTopLooks && looksMatch >= 25) {
    reasons.push(`好みの${typeName(thTopLooks)}`);
  }
  if (paramMatch >= 65) {
    reasons.push("施術の好みが近い");
  }
  if (thTopBody && bodyMatch >= 30) {
    reasons.push(`好みの${bodyTypeName(thTopBody)}体型`);
  }

  return { therapistId, score, label, color, reasons, needsMoreReviews: false };
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const therapistIdsParam = searchParams.get("therapist_ids");
  if (!therapistIdsParam) {
    return NextResponse.json({ error: "therapist_ids required" }, { status: 400 });
  }

  const therapistIds = therapistIdsParam
    .split(",")
    .map(Number)
    .filter((n) => n > 0)
    .slice(0, 20); // max 20 at a time

  if (therapistIds.length === 0) {
    return NextResponse.json({ error: "Invalid therapist_ids" }, { status: 400 });
  }

  // Fetch user's approved reviews and therapist reviews in parallel
  const [userReviewsRes, therapistReviewsRes] = await Promise.all([
    supabaseAdmin
      .from("reviews")
      .select(
        "looks_type_id, body_type_id, service_level_id, param_conversation, param_distance, param_technique, param_personality, score"
      )
      .eq("user_id", user.id)
      .eq("moderation_status", "approved"),
    supabaseAdmin
      .from("reviews")
      .select(
        "therapist_id, looks_type_id, body_type_id, service_level_id, param_conversation, param_distance, param_technique, param_personality, score"
      )
      .in("therapist_id", therapistIds)
      .eq("moderation_status", "approved"),
  ]);

  const userReviews = (userReviewsRes.data || []) as ReviewRow[];
  const therapistReviews = (therapistReviewsRes.data || []) as (ReviewRow & {
    therapist_id: number;
  })[];

  // Group therapist reviews by therapist_id
  const byTherapist: Record<string, ReviewRow[]> = {};
  for (const r of therapistReviews) {
    const key = String(r.therapist_id);
    if (!byTherapist[key]) byTherapist[key] = [];
    byTherapist[key].push(r);
  }

  // Calculate compatibility for each
  const results: Record<string, CompatibilityResult> = {};
  for (const tid of therapistIds) {
    const key = String(tid);
    results[key] = calculate(userReviews, byTherapist[key] || [], key);
  }

  return NextResponse.json(results);
}
