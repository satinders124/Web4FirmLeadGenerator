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
      sms_text: proposal.sms,
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

export async function recordSms({ lead, recipientPhone, bodyText, status = "sent" }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const crmLead = await upsertCrmLead(lead, { status: "contacted", last_contacted_at: new Date().toISOString() });
  const { data, error } = await supabase
    .from("outreach_sms")
    .insert({
      lead_id: crmLead.id,
      recipient_phone: recipientPhone,
      body_text: bodyText,
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) throw error;
  return { crmLead, sms: data };
}

export async function saveWebsiteAudit({ lead, audit, model }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const crmLead = await upsertCrmLead(lead, { status: "proposal_ready" });
  const { data, error } = await supabase
    .from("website_audits")
    .insert({
      lead_id: crmLead.id,
      source_url: audit.sourceUrl || null,
      audit_type: audit.auditType,
      opportunity_score: audit.opportunityScore,
      technical_facts: audit.technicalFacts,
      headline: audit.headline,
      summary: audit.summary,
      strengths: audit.strengths,
      opportunities: audit.opportunities,
      recommended_actions: audit.recommendedActions,
      model: model || null,
    })
    .select()
    .single();
  if (error) throw error;
  return { crmLead, audit: data };
}

export async function scheduleFollowUps({ lead, outreachEmail, followUps }) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !followUps?.length) return [];
  const crmLead = await upsertCrmLead(lead, { status: "contacted", last_contacted_at: new Date().toISOString() });
  const sentAt = new Date();
  const rows = followUps.slice(0, 3).map((followUp, index) => {
    const offset = Number(followUp.dayOffset) || [3, 7, 14][index] || 14;
    const dueAt = new Date(sentAt.getTime() + offset * 24 * 60 * 60 * 1000);
    return {
      lead_id: crmLead.id,
      outreach_email_id: outreachEmail?.id || null,
      recipient_email: outreachEmail?.recipient_email || followUp.recipientEmail || "",
      step: index + 1,
      channel: "email",
      subject: followUp.subject || "Following up",
      body_text: followUp.text || "",
      due_at: dueAt.toISOString(),
    };
  }).filter((row) => row.recipient_email && row.body_text);
  if (!rows.length) return [];
  const { data, error } = await supabase.from("follow_ups").insert(rows).select();
  if (error) throw error;
  return data;
}

export async function createWebsitePreview({ lead, previewContent }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const crmLead = await upsertCrmLead(lead, { status: "proposal_ready" });
  const slug = `${lead.google_place_id || lead.id}-${crypto.randomUUID().slice(0, 8)}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const { data, error } = await supabase
    .from("website_previews")
    .insert({ lead_id: crmLead.id, slug, preview_content: previewContent })
    .select()
    .single();
  if (error) throw error;
  return { crmLead, preview: data };
}
