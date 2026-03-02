import { supabaseAdmin } from "@/lib/supabase-admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { therapistTypes, bodyTypes } from "@/lib/data";

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
  id: string;
  user_id: string;
  therapist_id: number;
  salon_id: number;
  score: number;
  looks_type_id: number | null;
  body_type_id: number | null;
  service_level_id: number | null;
  param_conversation: number | null;
  param_distance: number | null;
  param_technique: number | null;
  param_personality: number | null;
}

interface Recommendation {
  therapist_id: number;
  name: string;
  age: number | null;
  image_url: string | null;
  salon_id: number;
  shop_name: string;
  predicted_score: number;
  similar_user_count: number;
  reasons: string[];
}

function typeName(id: number): string {
  return therapistTypes.find((t) => t.id === String(id))?.label || "";
}

function bodyName(id: number): string {
  return bodyTypes.find((t) => t.id === String(id))?.label || "";
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 20);
  const excludeSalonId = searchParams.get("exclude_salon_id");

  // Fetch all approved reviews with structured data (seed口コミ=user_id NULLを除外)
  const { data: allReviews } = await supabaseAdmin
    .from("reviews")
    .select(
      "id, user_id, therapist_id, salon_id, score, looks_type_id, body_type_id, service_level_id, param_conversation, param_distance, param_technique, param_personality"
    )
    .eq("moderation_status", "approved")
    .not("user_id", "is", null);

  if (!allReviews || allReviews.length === 0) {
    return NextResponse.json([]);
  }

  const reviews = allReviews as ReviewRow[];

  // Split into user's reviews and others
  const myReviews = reviews.filter((r) => r.user_id === user.id);
  if (myReviews.length < 2) {
    return NextResponse.json([]);
  }

  const myTherapistIds = new Set(myReviews.map((r) => r.therapist_id));
  const otherReviews = reviews.filter((r) => r.user_id !== user.id);

  // Group other reviews by user
  const byUser: Record<string, ReviewRow[]> = {};
  for (const r of otherReviews) {
    if (!byUser[r.user_id]) byUser[r.user_id] = [];
    byUser[r.user_id].push(r);
  }

  // Calculate similarity with each other user
  // Based on: shared therapist score correlation + type preference overlap
  const userSimilarities: { userId: string; similarity: number; reviews: ReviewRow[] }[] = [];

  const myScoreMap: Record<number, number> = {};
  for (const r of myReviews) {
    myScoreMap[r.therapist_id] = r.score;
  }

  // My type preferences
  const myLooksCounts: Record<number, number> = {};
  const myBodyCounts: Record<number, number> = {};
  for (const r of myReviews) {
    if (r.looks_type_id) myLooksCounts[r.looks_type_id] = (myLooksCounts[r.looks_type_id] || 0) + 1;
    if (r.body_type_id) myBodyCounts[r.body_type_id] = (myBodyCounts[r.body_type_id] || 0) + 1;
  }
  const myTopLooks = Object.entries(myLooksCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const myTopBody = Object.entries(myBodyCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  for (const [userId, userRevs] of Object.entries(byUser)) {
    if (userRevs.length < 2) continue;

    // Score correlation on shared therapists
    const sharedScores: { my: number; their: number }[] = [];
    for (const r of userRevs) {
      if (myScoreMap[r.therapist_id] != null) {
        sharedScores.push({ my: myScoreMap[r.therapist_id], their: r.score });
      }
    }

    let scoreSimilarity = 0;
    if (sharedScores.length >= 1) {
      // Mean absolute error (inverted to similarity)
      const mae =
        sharedScores.reduce((sum, s) => sum + Math.abs(s.my - s.their), 0) /
        sharedScores.length;
      scoreSimilarity = Math.max(0, 1 - mae / 50); // 50-point diff = 0 similarity
    }

    // Type preference overlap
    let typeOverlap = 0;
    const theirLooksCounts: Record<number, number> = {};
    for (const r of userRevs) {
      if (r.looks_type_id) theirLooksCounts[r.looks_type_id] = (theirLooksCounts[r.looks_type_id] || 0) + 1;
    }
    const theirTopLooks = Object.entries(theirLooksCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (myTopLooks && theirTopLooks && myTopLooks === theirTopLooks) {
      typeOverlap = 1;
    }

    const similarity =
      sharedScores.length >= 1
        ? scoreSimilarity * 0.6 + typeOverlap * 0.4
        : typeOverlap * 0.3; // Low confidence without shared reviews

    if (similarity > 0.15) {
      userSimilarities.push({ userId, similarity, reviews: userRevs });
    }
  }

  // Sort by similarity (most similar first)
  userSimilarities.sort((a, b) => b.similarity - a.similarity);
  const topSimilarUsers = userSimilarities.slice(0, 50);

  if (topSimilarUsers.length === 0) {
    return NextResponse.json([]);
  }

  // Find therapists that similar users liked but I haven't reviewed
  const candidateScores: Record<
    number,
    { totalWeightedScore: number; totalWeight: number; userCount: number; salonId: number; looksTypes: Record<number, number>; scores: number[] }
  > = {};

  for (const { similarity, reviews: userRevs } of topSimilarUsers) {
    for (const r of userRevs) {
      if (myTherapistIds.has(r.therapist_id)) continue;
      if (r.score < 60) continue; // Only recommend positively-reviewed therapists
      if (excludeSalonId && r.salon_id === Number(excludeSalonId)) continue;

      if (!candidateScores[r.therapist_id]) {
        candidateScores[r.therapist_id] = {
          totalWeightedScore: 0,
          totalWeight: 0,
          userCount: 0,
          salonId: r.salon_id,
          looksTypes: {},
          scores: [],
        };
      }

      const c = candidateScores[r.therapist_id];
      c.totalWeightedScore += r.score * similarity;
      c.totalWeight += similarity;
      c.userCount++;
      c.scores.push(r.score);
      if (r.looks_type_id) {
        c.looksTypes[r.looks_type_id] = (c.looksTypes[r.looks_type_id] || 0) + 1;
      }
    }
  }

  // Rank candidates
  const ranked = Object.entries(candidateScores)
    .map(([therapistId, c]) => ({
      therapistId: Number(therapistId),
      predictedScore: Math.round(c.totalWeightedScore / c.totalWeight),
      userCount: c.userCount,
      salonId: c.salonId,
      avgScore: Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length),
      topLooksType: Object.entries(c.looksTypes).sort((a, b) => b[1] - a[1])[0]?.[0],
    }))
    .filter((c) => c.userCount >= 1)
    .sort((a, b) => {
      // Sort by: predicted score * log(user count + 1) for confidence-adjusted ranking
      const aRank = a.predictedScore * Math.log2(a.userCount + 1);
      const bRank = b.predictedScore * Math.log2(b.userCount + 1);
      return bRank - aRank;
    })
    .slice(0, limit);

  if (ranked.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch therapist details
  const therapistIds = ranked.map((r) => r.therapistId);
  const { data: therapists } = await supabaseAdmin
    .from("therapists")
    .select("id, name, age, image_urls, salon_id, salons(name, display_name)")
    .in("id", therapistIds)
    .eq("status", "active");

  if (!therapists) {
    return NextResponse.json([]);
  }

  const therapistMap = new Map<number, (typeof therapists)[0]>();
  for (const t of therapists) {
    therapistMap.set(Number(t.id), t);
  }

  // Build response
  const results: Recommendation[] = [];
  for (const r of ranked) {
    const t = therapistMap.get(r.therapistId);
    if (!t) continue;

    const imgs = t.image_urls as string[] | null;
    const shop = t.salons as unknown as { name: string; display_name: string | null } | null;

    const reasons: string[] = [];
    reasons.push(`好みが近い${r.userCount}人が平均${r.avgScore}点`);
    if (r.topLooksType && myTopLooks === r.topLooksType) {
      reasons.push(`好みの${typeName(Number(r.topLooksType))}`);
    }

    results.push({
      therapist_id: r.therapistId,
      name: t.name.replace(/\s*\(\d{2}\)$/, ""),
      age: t.age,
      image_url: imgs?.[0] || null,
      salon_id: Number(t.salon_id),
      shop_name: shop?.display_name || shop?.name || "",
      predicted_score: r.predictedScore,
      similar_user_count: r.userCount,
      reasons,
    });
  }

  return NextResponse.json(results);
}
