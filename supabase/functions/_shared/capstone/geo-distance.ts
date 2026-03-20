/**
 * Geographic Distance Utility for Capstone Pipeline
 * Haversine formula for proximity-based company sorting
 * Simplified from EduThree1 (849 lines → essentials only)
 */

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two points in miles using Haversine formula
 */
export function calculateDistanceMiles(
  point1: GeoCoordinates,
  point2: GeoCoordinates
): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.latitude)) * Math.cos(toRad(point2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Known locations lookup (subset of most common cities)
 */
const KNOWN_LOCATIONS: Record<string, GeoCoordinates> = {
  'new york, ny': { latitude: 40.7128, longitude: -74.0060 },
  'san francisco, ca': { latitude: 37.7749, longitude: -122.4194 },
  'los angeles, ca': { latitude: 34.0522, longitude: -118.2437 },
  'chicago, il': { latitude: 41.8781, longitude: -87.6298 },
  'seattle, wa': { latitude: 47.6062, longitude: -122.3321 },
  'austin, tx': { latitude: 30.2672, longitude: -97.7431 },
  'boston, ma': { latitude: 42.3601, longitude: -71.0589 },
  'denver, co': { latitude: 39.7392, longitude: -104.9903 },
  'atlanta, ga': { latitude: 33.7490, longitude: -84.3880 },
  'dallas, tx': { latitude: 32.7767, longitude: -96.7970 },
  'houston, tx': { latitude: 29.7604, longitude: -95.3698 },
  'miami, fl': { latitude: 25.7617, longitude: -80.1918 },
  'phoenix, az': { latitude: 33.4484, longitude: -112.0740 },
  'kansas city, mo': { latitude: 39.0997, longitude: -94.5786 },
  'bangalore, india': { latitude: 12.9716, longitude: 77.5946 },
  'mumbai, india': { latitude: 19.0760, longitude: 72.8777 },
  'london, uk': { latitude: 51.5074, longitude: -0.1278 },
  'toronto, canada': { latitude: 43.6532, longitude: -79.3832 },
  'singapore': { latitude: 1.3521, longitude: 103.8198 },
  'sydney, australia': { latitude: -33.8688, longitude: 151.2093 },
};

/**
 * Parse a location string into coordinates (best-effort)
 */
export function parseLocationToCoordinates(location: string): GeoCoordinates | null {
  if (!location) return null;
  const normalized = location.toLowerCase().trim();
  
  // Direct lookup
  if (KNOWN_LOCATIONS[normalized]) return KNOWN_LOCATIONS[normalized];
  
  // Try partial match
  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords;
    }
  }
  
  return null;
}
