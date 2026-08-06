import { NextResponse } from "next/server";
import { getSupabaseAdmin, hasSupabaseConfig } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function PATCH(request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase CRM is not configured yet." }, { status: 503 });
  try {
    const { id, status } = await request.json();
    if (!id || !["sent", "skipped"].includes(status)) return NextResponse.json({ error: "A follow-up ID and valid status are required." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("follow_ups")
      .update({ status, completed_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ followUp: data });
  } catch (error) {
    console.error("Follow-up update failed", error);
    return NextResponse.json({ error: "Unable to update follow-up." }, { status: 500 });
  }
}
