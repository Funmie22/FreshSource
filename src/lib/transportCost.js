const ZONE_RATES = {
  'Lagos': 45,
  'Oyo': 55,
  'Kano State': 70,
  'Kaduna State': 90,
  'Enugu State': 80,
  'Rivers State': 95,
  'Abuja Federal Capital Territory': 100,
}

export function getTransportCost(location) {
  return ZONE_RATES[location] || 60
}