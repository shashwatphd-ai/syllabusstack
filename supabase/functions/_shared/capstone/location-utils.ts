/**
 * Location Utilities for Capstone Discovery
 * Normalizes and generates location variants for Apollo API search.
 * Includes metro area awareness for improved location scoring.
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

const STATE_REVERSE_MAP: Record<string, string> = {};
for (const [abbr, full] of Object.entries(STATE_MAP)) {
  STATE_REVERSE_MAP[full.toLowerCase()] = abbr;
}

// ============================================
// METRO AREA LOOKUP (~30 US metro groups)
// ============================================

const METRO_AREAS: Record<string, string[]> = {
  'new york': ['manhattan', 'brooklyn', 'queens', 'bronx', 'staten island', 'jersey city', 'hoboken', 'newark', 'yonkers', 'new rochelle', 'white plains', 'stamford', 'long island city'],
  'los angeles': ['santa monica', 'pasadena', 'glendale', 'burbank', 'long beach', 'torrance', 'inglewood', 'culver city', 'west hollywood', 'beverly hills', 'el segundo'],
  'san francisco': ['oakland', 'berkeley', 'san jose', 'palo alto', 'mountain view', 'sunnyvale', 'santa clara', 'menlo park', 'redwood city', 'fremont', 'hayward', 'san mateo', 'cupertino', 'south san francisco', 'daly city'],
  'chicago': ['evanston', 'oak park', 'naperville', 'schaumburg', 'arlington heights', 'skokie', 'des plaines', 'cicero'],
  'boston': ['cambridge', 'somerville', 'brookline', 'quincy', 'waltham', 'newton', 'medford', 'malden', 'watertown'],
  'seattle': ['bellevue', 'redmond', 'kirkland', 'tacoma', 'renton', 'bothell', 'kent', 'everett'],
  'washington': ['arlington', 'alexandria', 'bethesda', 'silver spring', 'falls church', 'mclean', 'reston', 'tysons', 'college park'],
  'dallas': ['fort worth', 'plano', 'irving', 'arlington', 'frisco', 'richardson', 'garland', 'mckinney', 'denton'],
  'houston': ['sugar land', 'the woodlands', 'pasadena', 'pearland', 'league city', 'katy', 'baytown'],
  'atlanta': ['sandy springs', 'marietta', 'roswell', 'alpharetta', 'decatur', 'smyrna', 'kennesaw', 'duluth'],
  'miami': ['fort lauderdale', 'hialeah', 'coral gables', 'doral', 'boca raton', 'pompano beach', 'hollywood', 'aventura'],
  'denver': ['aurora', 'lakewood', 'boulder', 'centennial', 'arvada', 'westminster', 'thornton', 'broomfield'],
  'phoenix': ['scottsdale', 'mesa', 'tempe', 'chandler', 'gilbert', 'glendale', 'peoria'],
  'philadelphia': ['camden', 'cherry hill', 'wilmington', 'conshohocken', 'king of prussia', 'norristown'],
  'minneapolis': ['saint paul', 'st paul', 'bloomington', 'eden prairie', 'plymouth', 'maple grove', 'eagan'],
  'detroit': ['dearborn', 'ann arbor', 'troy', 'southfield', 'royal oak', 'farmington hills', 'warren'],
  'portland': ['beaverton', 'hillsboro', 'lake oswego', 'tigard', 'gresham', 'vancouver'],
  'san diego': ['chula vista', 'oceanside', 'carlsbad', 'escondido', 'el cajon', 'la jolla'],
  'austin': ['round rock', 'cedar park', 'pflugerville', 'georgetown', 'san marcos', 'kyle'],
  'nashville': ['franklin', 'murfreesboro', 'brentwood', 'hendersonville', 'gallatin', 'lebanon'],
  'charlotte': ['concord', 'gastonia', 'huntersville', 'mooresville', 'rock hill', 'matthews'],
  'pittsburgh': ['cranberry township', 'bethel park', 'moon township', 'monroeville'],
  'salt lake city': ['west valley city', 'provo', 'sandy', 'orem', 'west jordan', 'draper', 'lehi'],
  'kansas city': ['overland park', 'olathe', 'lee\'s summit', 'shawnee', 'lenexa', 'independence'],
  'columbus': ['dublin', 'westerville', 'grove city', 'hilliard', 'reynoldsburg', 'upper arlington'],
  'indianapolis': ['carmel', 'fishers', 'noblesville', 'greenwood', 'westfield'],
  'san antonio': ['new braunfels', 'schertz', 'boerne', 'converse', 'live oak'],
  'raleigh': ['durham', 'chapel hill', 'cary', 'apex', 'morrisville', 'wake forest'],
  'tampa': ['st petersburg', 'clearwater', 'brandon', 'lakeland', 'sarasota'],
  'baltimore': ['towson', 'columbia', 'ellicott city', 'annapolis', 'glen burnie'],
};

/**
 * Check if two location strings are in the same metro area.
 * `city` is a single city name; `addressString` is a full address.
 */
export function isSameMetroArea(city: string, addressString: string): boolean {
  const lowerCity = city.toLowerCase().trim();
  const lowerAddress = addressString.toLowerCase();

  for (const [metro, cities] of Object.entries(METRO_AREAS)) {
    const allCities = [metro, ...cities];
    const cityInMetro = allCities.some(c => lowerCity.includes(c) || c.includes(lowerCity));
    if (!cityInMetro) continue;
    const addressInMetro = allCities.some(c => lowerAddress.includes(c));
    if (addressInMetro) return true;
  }

  return false;
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
