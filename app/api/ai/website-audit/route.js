import { lookup } from "dns/promises";
import net from "net";
import { NextResponse } from "next/server";
import { categoryLabel } from "../../../../lib/lead-utils";
import { saveWebsiteAudit } from "../../../../lib/crm";
import { hasSupabaseConfig } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_HTML_BYTES = 450_000;

function stripJsonFences(value) {
  return String(value || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function isPrivateIp(ip) {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (net.isIP(ip) === 6) {
    const normalized = ip.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80");
  }
  return true;
}

async function assertPublicUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only public HTTP or HTTPS websites can be audited.");
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase())) throw new Error("Local addresses cannot be audited.");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) throw new Error("This website does not resolve to a public address.");
  return url;
}

async function limitedText(response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let size = 0;
  while (size < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = MAX_HTML_BYTES - size;
    chunks.push(value.slice(0, remaining));
    size += value.byteLength;
    if (value.byteLength > remaining) break;
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => { merged.set(chunk, offset); offset += chunk.byteLength; });
  return new TextDecoder().decode(merged);
}

function contentMatch(html, pattern) {
  const match = html.match(pattern);
  return match?.[1]?.replace(/\s+/g, " ").trim() || "";
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

async function inspectWebsite(rawUrl) {
  let url = await assertPublicUrl(rawUrl);
  let response;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "Web4Firm-Website-Audit/1.0 (+https://web4firm.com)" },
        cache: "no-store",
      });
    } finally {
      clearTimeout(timer);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = response.headers.get("location");
      if (!next) break;
      url = await assertPublicUrl(new URL(next, url).toString());
      continue;
    }
    break;
  }
  if (!response || !response.ok) throw new Error("The website could not be reached for a public audit.");
  const html = await limitedText(response);
  const title = contentMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = contentMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || contentMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const h1 = contentMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return {
    sourceUrl: url.toString(),
    responseStatus: response.status,
    usesHttps: url.protocol === "https:",
    title,
    description,
    h1,
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    hasContactForm: /<form[\s>]/i.test(html),
    hasPhoneLink: /href=["']tel:/i.test(html),
    hasEmailLink: /href=["']mailto:/i.test(html),
    hasStructuredData: /application\/ld\+json/i.test(html),
    canonical: contentMatch(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)/i),
    visibleTextSample: visibleText(html),
  };
}

async function availableModels(apiKey) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/models", { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.data) ? data.data.map((model) => model?.id).filter(Boolean) : [];
  } catch { return []; }
}

function modelsToTry(ids) {
  return Array.from(new Set([
    process.env.ANTHROPIC_MODEL,
    "claude-sonnet-5",
    ...ids.filter((id) => id.includes("sonnet")),
    ...ids,
    "claude-3-7-sonnet-20250219",
    "claude-3-5-sonnet-latest",
    "claude-3-haiku-20240307",
  ].filter(Boolean)));
}

function normalizeAudit(value, lead, technicalFacts) {
  const audit = value && typeof value === "object" ? value : {};
  const array = (field) => Array.isArray(audit[field]) ? audit[field].filter((item) => typeof item === "string").slice(0, 5) : [];
  return {
    auditType: lead.website ? "website_review" : "no_website",
    sourceUrl: technicalFacts.sourceUrl || lead.website || "",
    opportunityScore: Math.min(Math.max(Number(audit.opportunityScore) || (lead.website ? 55 : 85), 0), 100),
    technicalFacts,
    headline: String(audit.headline || `A clear digital opportunity for ${lead.name}`).slice(0, 140),
    summary: String(audit.summary || "A practical website opportunity based on the available public business information.").slice(0, 700),
    strengths: array("strengths"),
    opportunities: array("opportunities"),
    recommendedActions: array("recommendedActions"),
  };
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Claude is not configured yet. Add ANTHROPIC_API_KEY in Vercel environment variables." }, { status: 503 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid audit request." }, { status: 400 }); }
  const lead = body?.lead;
  if (!lead?.name) return NextResponse.json({ error: "Business details are required." }, { status: 400 });

  let technicalFacts = { sourceUrl: "", noWebsiteListed: !lead.website };
  if (lead.website) {
    try {
      technicalFacts = await inspectWebsite(lead.website);
    } catch (error) {
      technicalFacts = { sourceUrl: lead.website, fetchError: error.message, noWebsiteListed: false };
    }
  }

  const system = `You are a careful website audit consultant for Web4Firm. Audit only the observable technical facts and business facts provided. Do not claim to have tested pages you did not see, do not make performance/security guarantees, and do not invent business services, design problems, competitors or customer outcomes. Treat absent HTML signals as opportunities to investigate, not proof of a deficiency. For a business with no website listed, frame a new website opportunity. For a listed website, frame a respectful redesign/conversion opportunity.

Return ONLY valid JSON:
{
  "opportunityScore": 0-100,
  "headline": "string",
  "summary": "string",
  "strengths": ["string"],
  "opportunities": ["string"],
  "recommendedActions": ["string"]
}`;
  const prompt = JSON.stringify({
    business: { name: lead.name, category: categoryLabel(lead.categories), address: lead.address, rating: lead.rating, reviews: lead.reviews, website: lead.website || "No website listed" },
    technicalFacts,
  }, null, 2);

  const ids = await availableModels(apiKey);
  let parsed; let usedModel = ""; let lastError = "Claude could not complete the audit.";
  for (const model of modelsToTry(ids)) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 1400, temperature: 0.3, system, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await response.json();
      if (!response.ok) { lastError = data?.error?.message || `Model ${model} failed.`; if (response.status === 404 || response.status === 400) continue; if ([401, 403, 429].includes(response.status)) break; continue; }
      const text = data.content?.find((block) => block.type === "text")?.text || "";
      parsed = JSON.parse(stripJsonFences(text));
      usedModel = model;
      break;
    } catch (error) { lastError = error?.message || String(error); }
  }
  if (!parsed) return NextResponse.json({ error: lastError }, { status: 502 });

  const audit = normalizeAudit(parsed, lead, technicalFacts);
  let crmSaved = false;
  if (hasSupabaseConfig()) {
    try { await saveWebsiteAudit({ lead, audit, model: usedModel }); crmSaved = true; } catch (error) { console.error("Audit generated but CRM save failed", error); }
  }
  return NextResponse.json({ audit, model: usedModel, crmSaved });
}
