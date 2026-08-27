const FRESHNESS_WEIGHTS = {
  'Harvested Today': 10,
  'Harvested Yesterday': 6,
  'Harvesting Tomorrow': 3,
}

export function scoreListing(listing, allListings) {
  const sameType = allListings.filter((l) => l.crop_type === listing.crop_type)
  const avgPrice =
    sameType.reduce((sum, l) => sum + Number(l.price_per_unit), 0) / sameType.length

  const freshnessScore = FRESHNESS_WEIGHTS[listing.freshness] || 5

  const priceScore = avgPrice > 0
    ? Math.max(0, ((avgPrice - listing.price_per_unit) / avgPrice) * 10)
    : 0

  return freshnessScore + priceScore
}

export function getRecommended(listings, count = 3) {
  return [...listings]
    .map((l) => ({ ...l, matchScore: scoreListing(l, listings) }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, count)
}