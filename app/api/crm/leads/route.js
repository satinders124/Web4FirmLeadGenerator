import { NextResponse } from "next/server";
import { upsertCrmLead } from "../../../../lib/crm";
import { hasSupabaseConfig } from "../../../../lib/supabase-admin";

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
