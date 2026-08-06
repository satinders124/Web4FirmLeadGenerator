import { NextResponse } from "next/server";
import { leadScore, normalizePlace } from "../../../../lib/lead-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GOOGLE_PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

function invalid(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
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

  if (!query) return invalid("Enter a business category or search query.");

  const textQuery = location ? `${query} in ${location}` : query;

  try {
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
        ].join(","),
      },
      body: JSON.stringify({
        textQuery,
        pageSize: 20,
        languageCode: "en",
      }),
      cache: "no-store",
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Google Places search error", response.status, data?.error?.message);
      return invalid(data?.error?.message || "Google Places could not complete this search.", response.status);
    }

    const all = (data.places || []).map(normalizePlace);
    const candidates = all
      .filter((lead) => !lead.website && lead.rating >= minRating && lead.reviews >= minReviews)
      .map((lead) => ({ ...lead, score: leadScore(lead) }))
      .sort((a, b) => b.score - a.score);

    return NextResponse.json(
      {
        query: textQuery,
        totals: { found: all.length, noWebsite: candidates.length },
        leads: candidates,
      },
      { headers: { "Cache-Control": "no-store, no-cache, max-age=0" } }
    );
  } catch (error) {
    console.error("Lead search failed", error);
    return invalid("The lead search could not be completed. Check your Google Places configuration and try again.", 500);
  }
}
