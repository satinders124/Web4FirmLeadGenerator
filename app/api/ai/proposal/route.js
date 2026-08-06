import { NextResponse } from "next/server";
import { categoryLabel } from "../../../../lib/lead-utils";
import { saveProposal } from "../../../../lib/crm";
import { hasSupabaseConfig } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function stripJsonFences(value) {
  return String(value || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function safeArray(value, max = 6) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").slice(0, max) : [];
}

function normalizeProposal(value, lead) {
  const proposal = value && typeof value === "object" ? value : {};
  const email = proposal.email && typeof proposal.email === "object" ? proposal.email : {};
  const plan = proposal.websitePlan && typeof proposal.websitePlan === "object" ? proposal.websitePlan : {};

  return {
    opportunityType: proposal.opportunityType === "website redesign" ? "website redesign" : "new website",
    headline: String(proposal.headline || `A stronger online presence for ${lead.name}`).slice(0, 120),
    summary: String(proposal.summary || `A tailored Web4Firm website opportunity for ${lead.name}.`).slice(0, 600),
    websitePlan: {
      pages: safeArray(plan.pages),
      features: safeArray(plan.features),
      benefits: safeArray(plan.benefits),
    },
    email: {
      subject: String(email.subject || `A quick website idea for ${lead.name}`).slice(0, 140),
      html: String(email.html || `<p>Hi ${lead.name},</p><p>I noticed an opportunity to improve your online presence. Web4Firm can help with a clear, mobile-friendly website that makes it easier for customers to find and contact you.</p><p>Would you be open to a short, no-pressure conversation?</p><p>Kind regards,<br />Web4Firm</p>`).slice(0, 12000),
      text: String(email.text || `Hi ${lead.name},\n\nI noticed an opportunity to improve your online presence. Web4Firm can help with a clear, mobile-friendly website that makes it easier for customers to find and contact you.\n\nWould you be open to a short, no-pressure conversation?\n\nKind regards,\nWeb4Firm`).slice(0, 7000),
    },
  };
}

async function getAvailableModels(apiKey) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.data) ? data.data.map((model) => model?.id).filter(Boolean) : [];
  } catch (error) {
    console.warn("Could not retrieve Anthropic model list", error);
    return [];
  }
}

function modelCandidates(availableIds) {
  return Array.from(new Set([
    process.env.ANTHROPIC_MODEL,
    // Same preferred model/fallback order used by the working ProfitPnL repository.
    "claude-sonnet-5",
    ...availableIds.filter((id) => id.includes("sonnet")),
    ...availableIds,
    "claude-3-7-sonnet-20250219",
    "claude-3-7-sonnet-latest",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-latest",
    "claude-3-haiku-20240307",
  ].filter(Boolean)));
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Claude is not configured yet. Add ANTHROPIC_API_KEY in Vercel environment variables." },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid proposal request." }, { status: 400 });
  }

  const lead = body?.lead;
  if (!lead?.name) return NextResponse.json({ error: "Business details are required." }, { status: 400 });

  const businessFacts = {
    name: lead.name,
    category: categoryLabel(lead.categories),
    address: lead.address || "Not provided",
    rating: lead.rating || "Not provided",
    reviews: lead.reviews || "Not provided",
    phone: lead.phone || "Not provided",
    websiteStatus: lead.website ? `Website listed: ${lead.website}` : "No website listed in Google Places",
  };

  const system = `You are a senior B2B website consultant and ethical sales copywriter for Web4Firm. Web4Firm helps local businesses with professional, mobile-first websites, clear services/pages, enquiry flows, local discoverability foundations, and Google Business Profile alignment.

Create a concise, credible, highly personalised website opportunity and sales email using ONLY the business facts provided. Do not invent services, awards, customers, locations, business history, revenue, or problems. If a detail is unknown, frame it as a possibility or a question, never as a fact.

If the business has no website listed, pitch a new website. If a website is listed, pitch a respectful website redesign/conversion improvement. The email must be warm, specific, short enough to send manually, non-pushy, and include a single low-pressure call to action. Do not mention AI, scraping, lead generation, Google Places, or data collection. Do not make guarantees.

Return ONLY valid JSON with this exact shape:
{
  "opportunityType": "new website" or "website redesign",
  "headline": "string",
  "summary": "string",
  "websitePlan": { "pages": ["string"], "features": ["string"], "benefits": ["string"] },
  "email": { "subject": "string", "html": "safe HTML using only p, strong, ul, li, br tags", "text": "plain text equivalent" }
}`;

  const user = `Business facts:\n${JSON.stringify(businessFacts, null, 2)}`;

  try {
    const availableIds = await getAvailableModels(apiKey);
    const modelsToTry = modelCandidates(availableIds);
    let proposal = null;
    let usedModel = "";
    let lastError = "Claude could not generate a proposal.";

    for (const model of modelsToTry) {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 1800,
            temperature: 0.45,
            system,
            messages: [{ role: "user", content: user }],
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          lastError = result?.error?.message || `Model ${model} could not run.`;
          // A model name can be unavailable on the current key; try the next compatible candidate.
          if (response.status === 404 || response.status === 400) continue;
          if (response.status === 401 || response.status === 403 || response.status === 429) break;
          continue;
        }

        const textBlock = result.content?.find((block) => block.type === "text");
        proposal = normalizeProposal(JSON.parse(stripJsonFences(textBlock?.text)), lead);
        usedModel = model;
        break;
      } catch (modelError) {
        lastError = modelError?.message || String(modelError);
        console.warn(`Claude model ${model} failed`, lastError);
      }
    }

    if (!proposal) {
      const available = availableIds.length ? ` Available models: ${availableIds.join(", ")}.` : "";
      return NextResponse.json({ error: `${lastError}.${available}` }, { status: 502 });
    }

    let crmSaved = false;
    if (hasSupabaseConfig()) {
      try {
        await saveProposal({ lead, proposal, model: usedModel });
        crmSaved = true;
      } catch (crmError) {
        console.error("Proposal generated but CRM save failed", crmError);
      }
    }
    return NextResponse.json({ proposal, model: usedModel, crmSaved });
  } catch (error) {
    console.error("Claude request failed", error);
    return NextResponse.json({ error: "Unable to reach Claude. Please try again." }, { status: 500 });
  }
}
