import { NextResponse } from "next/server";
import { createWebsitePreview } from "../../../lib/crm";
import { hasSupabaseConfig } from "../../../lib/supabase-admin";
import { categoryLabel } from "../../../lib/lead-utils";

export const dynamic = "force-dynamic";

function safeItems(items, fallback) {
  const values = Array.isArray(items) ? items.filter((item) => typeof item === "string").slice(0, 5) : [];
  return values.length ? values : fallback;
}

export async function POST(request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase CRM is not configured yet. Configure it before creating website previews." }, { status: 503 });
  }

  try {
    const { lead, proposal, audit } = await request.json();
    if (!lead?.id || !lead?.name) return NextResponse.json({ error: "Valid business details are required." }, { status: 400 });

    const content = {
      businessName: lead.name,
      category: categoryLabel(lead.categories),
      address: lead.address || "",
      phone: lead.phone || "",
      heroHeading: proposal?.headline || `Welcome to ${lead.name}`,
      summary: proposal?.summary || `A modern online concept for ${lead.name}.`,
      services: safeItems(proposal?.websitePlan?.pages, ["About", "Services", "Reviews", "Contact"]),
      features: safeItems(proposal?.websitePlan?.features, ["Mobile-first layout", "Clear enquiry flow", "Trust-building content"]),
      auditHeadline: audit?.headline || "A clearer online experience",
      opportunityScore: audit?.opportunityScore || null,
      generatedAt: new Date().toISOString(),
    };

    const saved = await createWebsitePreview({ lead, previewContent: content });
    const url = new URL(`/demo/${saved.preview.slug}`, request.url).toString();
    return NextResponse.json({ preview: saved.preview, url });
  } catch (error) {
    console.error("Website preview generation failed", error);
    return NextResponse.json({ error: "Unable to create the website preview." }, { status: 500 });
  }
}
