import { NextResponse } from "next/server";
import { recordSms } from "../../../../lib/crm";
import { hasSupabaseConfig } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase CRM is not configured yet." }, { status: 503 });
  }
  try {
    const { lead, recipientPhone, bodyText, status } = await request.json();
    if (!lead?.id || !recipientPhone || !bodyText) {
      return NextResponse.json({ error: "Lead, recipient phone and message are required." }, { status: 400 });
    }
    const saved = await recordSms({ lead, recipientPhone, bodyText, status: status || "sent" });
    return NextResponse.json({ ok: true, ...saved });
  } catch (error) {
    console.error("SMS CRM save failed", error);
    return NextResponse.json({ error: "Unable to record the SMS in the CRM." }, { status: 500 });
  }
}
