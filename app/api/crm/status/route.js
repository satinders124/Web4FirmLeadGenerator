import { NextResponse } from "next/server";
import { getSupabaseAdmin, hasSupabaseConfig } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

const allowed = new Set(["new", "proposal_ready", "contacted", "delivered", "replied", "qualified", "won", "lost", "bounced"]);

export async function PATCH(request) {
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase CRM is not configured yet." }, { status: 503 });
  try {
    const { id, status, notes } = await request.json();
    if (!id || !allowed.has(status)) return NextResponse.json({ error: "A valid lead and status are required." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const update = { status, updated_at: new Date().toISOString() };
    if (typeof notes === "string") update.notes = notes;
    const { data, error } = await supabase.from("leads").update(update).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ lead: data });
  } catch (error) {
    console.error("CRM status update failed", error);
    return NextResponse.json({ error: "Unable to update lead status." }, { status: 500 });
  }
}
