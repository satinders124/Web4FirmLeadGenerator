import { categoryLabel } from "./lead-utils";
import { getSupabaseAdmin } from "./supabase-admin";

export function leadRecord(lead, overrides = {}) {
  return {
    google_place_id: lead.id,
    business_name: lead.name,
    category: categoryLabel(lead.categories),
    address: lead.address || null,
    phone: lead.phone || null,
    rating: lead.rating || null,
    review_count: lead.reviews || 0,
    website_url: lead.website || null,
    maps_url: lead.mapsUrl || null,
    latitude: lead.lat ?? null,
    longitude: lead.lng ?? null,
    lead_score: lead.score || 0,
    opportunity_type: lead.website ? "website_redesign" : "new_website",
    ...overrides,
  };
}

export async function upsertCrmLead(lead, overrides = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("leads")
    .upsert(leadRecord(lead, overrides), { onConflict: "google_place_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveProposal({ lead, proposal, model }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const crmLead = await upsertCrmLead(lead);
  const { data, error } = await supabase
    .from("proposals")
    .insert({
      lead_id: crmLead.id,
      model: model || null,
      opportunity_type: proposal.opportunityType,
      headline: proposal.headline,
      summary: proposal.summary,
      website_plan: proposal.websitePlan,
      email_subject: proposal.email.subject,
      email_html: proposal.email.html,
      email_text: proposal.email.text,
    })
    .select()
    .single();
  if (error) throw error;
  return { crmLead, proposal: data };
}

export async function recordOutreach({ lead, recipient, subject, html, providerMessageId }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const crmLead = await upsertCrmLead(lead, { status: "contacted", last_contacted_at: new Date().toISOString() });
  const { data, error } = await supabase
    .from("outreach_emails")
    .insert({
      lead_id: crmLead.id,
      recipient_email: recipient,
      subject,
      body_html: html,
      provider_message_id: providerMessageId || null,
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return { crmLead, outreach: data };
}
