import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { therapist_name, salon_id } = body;

    if (!therapist_name || typeof therapist_name !== "string" || !therapist_name.trim()) {
      return NextResponse.json({ error: "therapist_name is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("missing_therapist_reports")
      .insert({
        therapist_name: therapist_name.trim(),
        salon_id: salon_id ? Number(salon_id) : null,
        status: "pending",
      });

    if (error) {
      console.error("Missing therapist report insert failed:", error);
      return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Missing therapist report error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
