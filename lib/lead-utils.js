export function normalizePlace(place) {
  return {
    id: place.id,
    name: place.displayName?.text || "Unnamed business",
    address: place.formattedAddress || "Address unavailable",
    phone: place.internationalPhoneNumber || place.nationalPhoneNumber || "",
    rating: typeof place.rating === "number" ? place.rating : 0,
    reviews: Number(place.userRatingCount || 0),
    categories: Array.isArray(place.types) ? place.types : [],
    website: place.websiteUri || "",
    mapsUrl: place.googleMapsUri || "",
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
  };
}

export function leadScore(lead) {
  const ratingScore = Math.min(lead.rating * 12, 60);
  const reviewScore = Math.min(Math.log10(Math.max(lead.reviews, 1)) * 18, 35);
  const noWebsiteBonus = lead.website ? 0 : 20;
  return Math.round(ratingScore + reviewScore + noWebsiteBonus);
}

export function categoryLabel(categories = []) {
  const ignore = new Set(["point_of_interest", "establishment", "food", "store"]);
  const category = categories.find((item) => !ignore.has(item)) || categories[0] || "Business";
  return category.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
