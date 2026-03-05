import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { therapist_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { therapist_id } = body;
  if (!therapist_id) {
    return NextResponse.json(
      { error: "therapist_id is required" },
      { status: 400 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: process.env.STRIPE_SINGLE_UNLOCK_PRICE_ID!,
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      metadata: { therapist_id: String(therapist_id) },
      success_url: `${
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001"
      }/therapist/${therapist_id}?unlocked=true`,
      cancel_url: `${
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001"
      }/therapist/${therapist_id}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[Checkout] Failed to create session:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
