import { NextResponse } from "next/server";
import { getSupabaseAdmin, hasSupabaseConfig } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase CRM is not configured yet." }, { status: 503 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const [leadsResult, emailResult, repliesResult] = await Promise.all([
      supabase.from("leads").select("*").order("updated_at", { ascending: false }).limit(100),
      supabase.from("outreach_emails").select("id,lead_id,recipient_email,subject,status,sent_at,delivered_at,replied_at,created_at").order("created_at", { ascending: false }).limit(250),
      supabase.from("inbound_replies").select("id,lead_id,subject,from_email,received_at").order("received_at", { ascending: false }).limit(100),
    ]);

    if (leadsResult.error) throw leadsResult.error;
    if (emailResult.error) throw emailResult.error;
    if (repliesResult.error) throw repliesResult.error;

    const metrics = {
      totalLeads: leadsResult.data.length,
      newLeads: leadsResult.data.filter((lead) => lead.status === "new" || lead.status === "proposal_ready").length,
      contacted: leadsResult.data.filter((lead) => ["contacted", "delivered", "replied", "qualified", "won"].includes(lead.status)).length,
      replies: leadsResult.data.filter((lead) => ["replied", "qualified", "won"].includes(lead.status)).length,
      emailsSent: emailResult.data.filter((email) => email.status !== "draft").length,
    };

    return NextResponse.json({ leads: leadsResult.data, emails: emailResult.data, replies: repliesResult.data, metrics });
  } catch (error) {
    console.error("CRM overview failed", error);
    return NextResponse.json({ error: "Unable to load CRM data." }, { status: 500 });
  }
}
