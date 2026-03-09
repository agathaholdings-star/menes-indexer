import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, name, email, ...rest } = body;

    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("contact_submissions").insert({
      type,
      name: name || null,
      email: email || null,
      metadata: rest,
    });

    if (error) {
      console.error("Contact submission error:", error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Contact API error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
