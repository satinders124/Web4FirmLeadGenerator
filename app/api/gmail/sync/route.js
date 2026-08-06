import { google } from "googleapis";
import { getSupabaseAdmin, hasSupabaseConfig } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

function hasGmailConfig() {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN
  );
}

function headerValue(headers, name) {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function emailAddress(value) {
  const match = String(value || "").match(/<([^>]+)>/) || String(value || "").match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  return (match?.[1] || match?.[0] || "").trim().toLowerCase();
}

function decodeBase64Url(value) {
  if (!value) return "";
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function extractText(part) {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
  for (const child of part.parts || []) {
    const text = extractText(child);
    if (text) return text;
  }
  return "";
}

export async function POST() {
  if (!hasSupabaseConfig()) {
    return Response.json({ error: "Supabase CRM is not configured yet." }, { status: 503 });
  }
  if (!hasGmailConfig()) {
    return Response.json({ error: "Gmail reply sync is not configured yet. Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN in Vercel." }, { status: 503 });
  }

  try {
    const auth = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
    const gmail = google.gmail({ version: "v1", auth });
    const userId = process.env.GMAIL_USER_EMAIL || "me";
    const supabase = getSupabaseAdmin();

    const [{ data: outreach, error: outreachError }, { data: existingReplies, error: repliesError }] = await Promise.all([
      supabase.from("outreach_emails").select("id,lead_id,recipient_email,provider_message_id"),
      supabase.from("inbound_replies").select("provider_message_id"),
    ]);
    if (outreachError) throw outreachError;
    if (repliesError) throw repliesError;

    const outreachByRecipient = new Map();
    (outreach || []).forEach((email) => {
      const recipient = email.recipient_email?.toLowerCase();
      if (recipient && !outreachByRecipient.has(recipient)) outreachByRecipient.set(recipient, email);
    });
    const seen = new Set((existingReplies || []).map((reply) => reply.provider_message_id).filter(Boolean));

    const list = await gmail.users.messages.list({ userId, labelIds: ["INBOX"], maxResults: 100, q: "newer_than:90d" });
    let imported = 0;

    for (const item of list.data.messages || []) {
      if (!item.id || seen.has(item.id)) continue;
      const message = await gmail.users.messages.get({ userId, id: item.id, format: "full" });
      const headers = message.data.payload?.headers || [];
      const from = emailAddress(headerValue(headers, "From"));
      const relatedOutreach = outreachByRecipient.get(from);
      if (!relatedOutreach) continue;

      const subject = headerValue(headers, "Subject");
      const bodyText = extractText(message.data.payload).slice(0, 20000);
      const receivedAt = message.data.internalDate ? new Date(Number(message.data.internalDate)).toISOString() : new Date().toISOString();

      const { error: insertError } = await supabase.from("inbound_replies").insert({
        provider_message_id: item.id,
        lead_id: relatedOutreach.lead_id,
        outreach_email_id: relatedOutreach.id,
        from_email: from,
        subject,
        body_text: bodyText,
        received_at: receivedAt,
      });
      if (insertError) throw insertError;

      await Promise.all([
        supabase.from("outreach_emails").update({ status: "replied", replied_at: receivedAt }).eq("id", relatedOutreach.id),
        supabase.from("leads").update({ status: "replied", updated_at: receivedAt }).eq("id", relatedOutreach.lead_id),
      ]);
      imported += 1;
    }

    return Response.json({ ok: true, imported, checked: list.data.messages?.length || 0 });
  } catch (error) {
    console.error("Gmail sync failed", error);
    return Response.json({ error: "Unable to sync Gmail replies. Check the Gmail OAuth configuration." }, { status: 500 });
  }
}
