// Approximate coordinates for known Nigerian cities
export const TOWN_COORDS = {
  'Lagos Hub': { lat: 6.5244, lng: 3.3792 },
  'Lagos Central': { lat: 6.4541, lng: 3.3947 },
  'Ibadan': { lat: 7.3775, lng: 3.9470 },
  'Kano': { lat: 12.0022, lng: 8.5920 },
  'Kaduna': { lat: 10.5105, lng: 7.4165 },
  'Port Harcourt': { lat: 4.8156, lng: 7.0498 },
}

// Fallback: if location text doesn't match exactly, try partial match, else default to Lagos
export function getCoordsForLocation(locationText) {
  if (!locationText) return TOWN_COORDS['Lagos Hub']

  const exact = TOWN_COORDS[locationText]
  if (exact) return exact

  const partial = Object.keys(TOWN_COORDS).find((town) =>
    locationText.toLowerCase().includes(town.toLowerCase().split(' ')[0])
  )
  if (partial) return TOWN_COORDS[partial]

  return TOWN_COORDS['Lagos Hub'] // default fallback
}