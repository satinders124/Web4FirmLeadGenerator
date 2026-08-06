import { NextResponse } from "next/server";
import { leadScore, normalizePlace } from "../../../../lib/lead-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GOOGLE_PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const MAX_PAGES = 3;
const MAX_LEADS = 12;

function invalid(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function searchPage({ apiKey, textQuery, pageToken }) {
  const requestBody = {
    textQuery,
    pageSize: 20,
    languageCode: "en",
  };
  if (pageToken) requestBody.pageToken = pageToken;

  const response = await fetch(GOOGLE_PLACES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.internationalPhoneNumber",
        "places.nationalPhoneNumber",
        "places.rating",
        "places.userRatingCount",
        "places.types",
        "places.websiteUri",
        "places.location",
        "places.googleMapsUri",
        "nextPageToken",
      ].join(","),
    },
    body: JSON.stringify(requestBody),
    cache: "no-store",
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error?.message || "Google Places could not complete this search.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function POST(request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return invalid("Google Places is not configured. Add GOOGLE_MAPS_API_KEY in Vercel environment variables to run live searches.", 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return invalid("Invalid search request.");
  }

  const query = String(payload.query || "").trim();
  const location = String(payload.location || "").trim();
  const minRating = Math.max(0, Number(payload.minRating || 0));
  const minReviews = Math.max(0, Number(payload.minReviews || 0));
  const prospectType = payload.prospectType === "all" ? "all" : "noWebsite";

  if (!query) return invalid("Enter a business category or search query.");

  const textQuery = location ? `${query} in ${location}` : query;

  try {
    let pageToken = "";
    let pagesSearched = 0;
    let all = [];
    let candidates = [];

    // Search further result pages only while the first results do not yield enough prospects.
    // This prevents the dashboard from appearing broken when the most relevant 20 businesses all list a website.
    while (pagesSearched < MAX_PAGES && candidates.length < MAX_LEADS) {
      const result = await searchPage({ apiKey, textQuery, pageToken });
      pagesSearched += 1;
      const pageLeads = (result.places || []).map(normalizePlace);
      all = [...all, ...pageLeads];
      candidates = all
        .filter((lead) => (prospectType === "all" || !lead.website) && lead.rating >= minRating && lead.reviews >= minReviews)
        .map((lead) => ({ ...lead, score: leadScore(lead) }))
        .sort((a, b) => b.score - a.score);

      pageToken = result.nextPageToken || "";
      if (!pageToken) break;
    }

    // Guard against duplicate place IDs across returned pages.
    const uniqueAll = [...new Map(all.map((lead) => [lead.id, lead])).values()];
    const uniqueCandidates = [...new Map(candidates.map((lead) => [lead.id, lead])).values()];

    return NextResponse.json(
      {
        query: textQuery,
        prospectType,
        pagesSearched,
        totals: { found: uniqueAll.length, noWebsite: uniqueCandidates.length },
        leads: uniqueCandidates,
      },
      { headers: { "Cache-Control": "no-store, no-cache, max-age=0" } }
    );
  } catch (error) {
    console.error("Lead search failed", error);
    return invalid(error.message || "The lead search could not be completed. Check your Google Places configuration and try again.", error.status || 500);
  }
}
