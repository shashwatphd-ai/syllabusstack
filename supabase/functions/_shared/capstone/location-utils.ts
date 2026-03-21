/**
 * Location Utilities for Capstone Discovery
 * Normalizes and generates location variants for Apollo API search.
 * Ported from EduThree1's apollo-precise-discovery.ts location handling.
 */

const STATE_MAP: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia'
};

// Reverse map: full name → abbreviation
const STATE_REVERSE_MAP: Record<string, string> = {};
for (const [abbr, full] of Object.entries(STATE_MAP)) {
  STATE_REVERSE_MAP[full.toLowerCase()] = abbr;
}

/**
 * Normalize a location string for Apollo search:
 * - Strips zip codes
 * - Expands state abbreviations to full names
 * - Appends "United States"
 */
export function normalizeLocationForApollo(location: string): string {
  if (!location) return 'United States';

  // Strip zip codes (5-digit or 5+4)
  let normalized = location.replace(/,?\s*\d{5}(-\d{4})?/g, '').trim();

  // Expand state abbreviation: "Kansas City, MO" → "Kansas City, Missouri"
  const cityStateMatch = normalized.match(/^([^,]+),\s*([A-Z]{2})$/i);
  if (cityStateMatch) {
    const city = cityStateMatch[1].trim();
    const stateAbbr = cityStateMatch[2].toUpperCase();
    const stateFull = STATE_MAP[stateAbbr];
    if (stateFull) {
      normalized = `${city}, ${stateFull}`;
    }
  }

  // Append United States if not already present
  if (!normalized.toLowerCase().includes('united states') &&
      !normalized.toLowerCase().includes('usa')) {
    normalized = `${normalized}, United States`;
  }

  return normalized;
}

/**
 * Generate multiple location variants for Apollo fallback chain.
 * Apollo can be picky about format; providing variants increases hit rate.
 */
export function generateLocationVariants(location: string): string[] {
  const variants: string[] = [];
  const normalized = normalizeLocationForApollo(location);
  variants.push(normalized);

  // Parse "City, State" or "City, State, United States"
  const cityStateMatch = location.match(/^([^,]+),\s*([A-Za-z\s]+)/i);
  if (cityStateMatch) {
    const city = cityStateMatch[1].trim();
    let state = cityStateMatch[2].trim().replace(/,?\s*United States/i, '').trim();

    // Resolve to both abbreviation and full name
    const stateUpper = state.toUpperCase();
    const stateFull = STATE_MAP[stateUpper] || state;
    const stateAbbr = STATE_REVERSE_MAP[state.toLowerCase()] || stateUpper;

    // City, Full State, United States
    variants.push(`${city}, ${stateFull}, United States`);
    // City, Full State
    variants.push(`${city}, ${stateFull}`);
    // City, Abbr
    if (stateAbbr.length === 2) {
      variants.push(`${city}, ${stateAbbr}`);
    }
    // State only
    variants.push(stateFull);
    if (stateAbbr.length === 2) {
      variants.push(stateAbbr);
    }
  }

  // Always include United States as broadest fallback
  variants.push('United States');

  return [...new Set(variants)];
}

/**
 * Get the state abbreviation from a location string.
 */
export function extractStateFromLocation(location: string): string | null {
  const match = location.match(/,\s*([A-Z]{2})\b/);
  if (match) return match[1];

  // Try full name lookup
  for (const [full, abbr] of Object.entries(STATE_REVERSE_MAP)) {
    if (location.toLowerCase().includes(full)) return abbr;
  }

  return null;
}
