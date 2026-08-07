import { NextResponse } from "next/server";
import { upsertCrmLead } from "../../../../lib/crm";
import { hasSupabaseConfig } from "../../../../lib/supabase-admin";
import { requireAdmin } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase CRM is not configured yet." }, { status: 503 });
  }
  try {
    const { lead, overrides } = await request.json();
    if (!lead?.id || !lead?.name) return NextResponse.json({ error: "Valid lead details are required." }, { status: 400 });
    const saved = await upsertCrmLead(lead, overrides || {});
    return NextResponse.json({ lead: saved });
  } catch (error) {
    console.error("CRM lead save failed", error);
    return NextResponse.json({ error: "Unable to save lead to the CRM." }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase CRM is not configured yet." }, { status: 503 });
  }
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Lead ID is required." }, { status: 400 });

  try {
    const supabase = (await import("../../../../lib/supabase-admin")).getSupabaseAdmin();
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("CRM lead delete failed", error);
    return NextResponse.json({ error: "Unable to delete lead from the CRM." }, { status: 500 });
  }
}
