import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function stripJsonFences(value) {
  return String(value || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

async function getAvailableModels(apiKey) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.data) ? data.data.map((model) => model?.id).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function suggestionCandidates(availableIds) {
  return Array.from(new Set([
    process.env.ANTHROPIC_MODEL,
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

function normalizeRecommendation(item, fallbackLocation) {
  const minRating = Number(item?.minRating);
  const minReviews = Number(item?.minReviews);
  return {
    query: String(item?.query || "").trim().slice(0, 80),
    location: String(item?.location || fallbackLocation || "").trim().slice(0, 120),
    minRating: Number.isFinite(minRating) ? Math.min(Math.max(minRating, 0), 5) : 3.5,
    minReviews: Number.isFinite(minReviews) ? Math.min(Math.max(Math.round(minReviews), 0), 1000) : 5,
    prospectType: item?.prospectType === "all" ? "all" : "noWebsite",
    priority: ["High", "Medium", "Explore"].includes(item?.priority) ? item.priority : "Explore",
    reason: String(item?.reason || "A focused local search hypothesis to test.").trim().slice(0, 260),
  };
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Claude is not configured yet. Add ANTHROPIC_API_KEY in Vercel environment variables." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid search strategy request." }, { status: 400 });
  }

  const location = String(body?.location || "").trim();
  const currentQuery = String(body?.currentQuery || "").trim();
  if (!location) return NextResponse.json({ error: "Add a location before generating search ideas." }, { status: 400 });

  const system = `You are an ethical B2B lead research strategist for Web4Firm, a local-business website design agency. Suggest search hypotheses for finding businesses that could benefit from a new website or website redesign.

Use broad, durable signals only: owner-operated local-service categories, customer-facing businesses, clear local search intent, and businesses that may benefit from a professional mobile-first website. Do NOT claim verified business counts, market demand, competitor data, local demographics, website absence, or guaranteed lead quality. Treat each idea as a testable hypothesis, not a factual market finding.

Avoid sensitive targeting and do not suggest adult, gambling, political, medical, legal, financial, religious, or discriminatory categories. Keep suggestions professional, practical and relevant to the supplied area. Return ONLY valid JSON with this shape:
{
  "overview": "short disclaimer-style planning summary",
  "recommendations": [
    {
      "query": "business category to search",
      "location": "local area or suburb within the supplied location",
      "minRating": 3.5,
      "minReviews": 5,
      "prospectType": "noWebsite" or "all",
      "priority": "High" or "Medium" or "Explore",
      "reason": "why this is a useful search hypothesis without making factual claims"
    }
  ]
}`;
  const prompt = `Location to plan for: ${location}\nCurrent search, if any: ${currentQuery || "None"}\nGenerate 6 diverse, testable search ideas.`;

  const available = await getAvailableModels(apiKey);
  let raw = "";
  let usedModel = "";
  let lastError = "Claude could not create search ideas.";

  for (const model of suggestionCandidates(available)) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 1300, temperature: 0.6, system, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await response.json();
      if (!response.ok) {
        lastError = data?.error?.message || `Model ${model} could not run.`;
        if (response.status === 404 || response.status === 400) continue;
        if (response.status === 401 || response.status === 403 || response.status === 429) break;
        continue;
      }
      raw = data.content?.find((block) => block.type === "text")?.text || "";
      usedModel = model;
      break;
    } catch (error) {
      lastError = error?.message || String(error);
    }
  }

  if (!raw) return NextResponse.json({ error: lastError }, { status: 502 });

  try {
    const parsed = JSON.parse(stripJsonFences(raw));
    const recommendations = Array.isArray(parsed?.recommendations)
      ? parsed.recommendations.map((item) => normalizeRecommendation(item, location)).filter((item) => item.query).slice(0, 6)
      : [];
    return NextResponse.json({
      overview: String(parsed?.overview || "These are testable search hypotheses. Review the results and qualify each business before outreach.").slice(0, 500),
      recommendations,
      model: usedModel,
    });
  } catch {
    return NextResponse.json({ error: "Claude returned an unexpected search strategy format. Please try again." }, { status: 502 });
  }
}
