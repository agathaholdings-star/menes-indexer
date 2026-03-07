import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const user_id = formData.get("user_id") as string;
    const therapist_id = Number(formData.get("therapist_id"));
    const salon_id = Number(formData.get("salon_id"));

    // Validate required fields
    if (!user_id || !therapist_id || !salon_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify the user exists in auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (authError || !authUser?.user) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 });
    }

    // Handle verification image upload via service_role
    let verificationImagePath: string | null = null;
    const imageFile = formData.get("verification_image") as File | null;
    if (imageFile && imageFile.size > 0) {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const filePath = `${user_id}/${Date.now()}.${ext}`;
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const { error: uploadError } = await supabaseAdmin.storage
        .from("review-verifications")
        .upload(filePath, buffer, { contentType: imageFile.type });
      if (uploadError) {
        console.error("Guest image upload failed:", uploadError);
        // Continue without image — don't fail the whole submission
      } else {
        verificationImagePath = filePath;
      }
    }

    // Insert review using service_role (bypasses RLS)
    const { error: insertError } = await supabaseAdmin.from("reviews").insert({
      user_id,
      therapist_id,
      salon_id,
      looks_type_id: Number(formData.get("looks_type_id")),
      body_type_id: Number(formData.get("body_type_id")),
      cup_type_id: Number(formData.get("cup_type_id")),
      service_level_id: Number(formData.get("service_level_id")),
      param_conversation: Number(formData.get("param_conversation")),
      param_distance: Number(formData.get("param_distance")),
      param_technique: Number(formData.get("param_technique")),
      param_personality: Number(formData.get("param_personality")),
      score: Number(formData.get("score")),
      comment_reason: formData.get("comment_reason") as string,
      comment_first_impression: formData.get("comment_first_impression") as string,
      comment_style: formData.get("comment_style") as string,
      comment_service: formData.get("comment_service") as string,
      comment_service_detail: formData.get("comment_service_detail") as string,
      comment_cost: formData.get("comment_cost") as string,
      comment_revisit: formData.get("comment_revisit") as string,
      comment_advice: formData.get("comment_advice") as string,
      verification_image_path: verificationImagePath,
    });

    if (insertError) {
      console.error("Guest review insert failed:", insertError);
      return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Guest submit error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
