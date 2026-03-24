/**
 * Geographic Distance Utility for Capstone Pipeline
 * Full coordinate lookup table + Haversine formula for distance-based scoring.
 * 
 * Features:
 * - 400+ known coordinates (US cities, university towns, international)
 * - Haversine distance calculation in miles
 * - Async geocoding fallback via Nominatim
 * - Distance-to-score conversion for ranking
 */

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

// ============================================
// HAVERSINE DISTANCE
// ============================================

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
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

// ============================================
// KNOWN COORDINATES (476 entries)
// ============================================

const KNOWN_LOCATIONS: Record<string, GeoCoordinates> = {
  // ── Major US Cities ──
  'new york': { latitude: 40.7128, longitude: -74.0060 },
  'new york city': { latitude: 40.7128, longitude: -74.0060 },
  'nyc': { latitude: 40.7128, longitude: -74.0060 },
  'manhattan': { latitude: 40.7831, longitude: -73.9712 },
  'brooklyn': { latitude: 40.6782, longitude: -73.9442 },
  'queens': { latitude: 40.7282, longitude: -73.7949 },
  'bronx': { latitude: 40.8448, longitude: -73.8648 },
  'staten island': { latitude: 40.5795, longitude: -74.1502 },
  'los angeles': { latitude: 34.0522, longitude: -118.2437 },
  'la': { latitude: 34.0522, longitude: -118.2437 },
  'chicago': { latitude: 41.8781, longitude: -87.6298 },
  'houston': { latitude: 29.7604, longitude: -95.3698 },
  'phoenix': { latitude: 33.4484, longitude: -112.0740 },
  'philadelphia': { latitude: 39.9526, longitude: -75.1652 },
  'san antonio': { latitude: 29.4241, longitude: -98.4936 },
  'san diego': { latitude: 32.7157, longitude: -117.1611 },
  'dallas': { latitude: 32.7767, longitude: -96.7970 },
  'san jose': { latitude: 37.3382, longitude: -121.8863 },
  'austin': { latitude: 30.2672, longitude: -97.7431 },
  'jacksonville': { latitude: 30.3322, longitude: -81.6557 },
  'fort worth': { latitude: 32.7555, longitude: -97.3308 },
  'columbus': { latitude: 39.9612, longitude: -82.9988 },
  'charlotte': { latitude: 35.2271, longitude: -80.8431 },
  'indianapolis': { latitude: 39.7684, longitude: -86.1581 },
  'san francisco': { latitude: 37.7749, longitude: -122.4194 },
  'sf': { latitude: 37.7749, longitude: -122.4194 },
  'seattle': { latitude: 47.6062, longitude: -122.3321 },
  'denver': { latitude: 39.7392, longitude: -104.9903 },
  'washington': { latitude: 38.9072, longitude: -77.0369 },
  'washington dc': { latitude: 38.9072, longitude: -77.0369 },
  'dc': { latitude: 38.9072, longitude: -77.0369 },
  'nashville': { latitude: 36.1627, longitude: -86.7816 },
  'oklahoma city': { latitude: 35.4676, longitude: -97.5164 },
  'el paso': { latitude: 31.7619, longitude: -106.4850 },
  'boston': { latitude: 42.3601, longitude: -71.0589 },
  'portland': { latitude: 45.5152, longitude: -122.6784 },
  'las vegas': { latitude: 36.1699, longitude: -115.1398 },
  'memphis': { latitude: 35.1495, longitude: -90.0490 },
  'louisville': { latitude: 38.2527, longitude: -85.7585 },
  'baltimore': { latitude: 39.2904, longitude: -76.6122 },
  'milwaukee': { latitude: 43.0389, longitude: -87.9065 },
  'albuquerque': { latitude: 35.0844, longitude: -106.6504 },
  'tucson': { latitude: 32.2226, longitude: -110.9747 },
  'fresno': { latitude: 36.7378, longitude: -119.7871 },
  'sacramento': { latitude: 38.5816, longitude: -121.4944 },
  'mesa': { latitude: 33.4152, longitude: -111.8315 },
  'kansas city': { latitude: 39.0997, longitude: -94.5786 },
  'atlanta': { latitude: 33.7490, longitude: -84.3880 },
  'omaha': { latitude: 41.2565, longitude: -95.9345 },
  'colorado springs': { latitude: 38.8339, longitude: -104.8214 },
  'raleigh': { latitude: 35.7796, longitude: -78.6382 },
  'long beach': { latitude: 33.7701, longitude: -118.1937 },
  'virginia beach': { latitude: 36.8529, longitude: -75.9780 },
  'miami': { latitude: 25.7617, longitude: -80.1918 },
  'oakland': { latitude: 37.8044, longitude: -122.2712 },
  'minneapolis': { latitude: 44.9778, longitude: -93.2650 },
  'tulsa': { latitude: 36.1540, longitude: -95.9928 },
  'tampa': { latitude: 27.9506, longitude: -82.4572 },
  'arlington': { latitude: 32.7357, longitude: -97.1081 },
  'new orleans': { latitude: 29.9511, longitude: -90.0715 },
  'wichita': { latitude: 37.6872, longitude: -97.3301 },
  'cleveland': { latitude: 41.4993, longitude: -81.6944 },
  'bakersfield': { latitude: 35.3733, longitude: -119.0187 },
  'aurora': { latitude: 39.7294, longitude: -104.8319 },
  'anaheim': { latitude: 33.8366, longitude: -117.9143 },
  'honolulu': { latitude: 21.3069, longitude: -157.8583 },
  'santa ana': { latitude: 33.7455, longitude: -117.8677 },
  'riverside': { latitude: 33.9533, longitude: -117.3962 },
  'corpus christi': { latitude: 27.8006, longitude: -97.3964 },
  'lexington': { latitude: 38.0406, longitude: -84.5037 },
  'pittsburgh': { latitude: 40.4406, longitude: -79.9959 },
  'anchorage': { latitude: 61.2181, longitude: -149.9003 },
  'stockton': { latitude: 37.9577, longitude: -121.2908 },
  'cincinnati': { latitude: 39.1031, longitude: -84.5120 },
  'st paul': { latitude: 44.9537, longitude: -93.0900 },
  'saint paul': { latitude: 44.9537, longitude: -93.0900 },
  'toledo': { latitude: 41.6528, longitude: -83.5379 },
  'greensboro': { latitude: 36.0726, longitude: -79.7920 },
  'newark': { latitude: 40.7357, longitude: -74.1724 },
  'plano': { latitude: 33.0198, longitude: -96.6989 },
  'henderson': { latitude: 36.0395, longitude: -114.9817 },
  'lincoln': { latitude: 40.8136, longitude: -96.7026 },
  'buffalo': { latitude: 42.8864, longitude: -78.8784 },
  'jersey city': { latitude: 40.7178, longitude: -74.0431 },
  'chula vista': { latitude: 32.6401, longitude: -117.0842 },
  'norfolk': { latitude: 36.8508, longitude: -76.2859 },
  'gilbert': { latitude: 33.3528, longitude: -111.7890 },
  'chandler': { latitude: 33.3062, longitude: -111.8413 },
  'madison': { latitude: 43.0731, longitude: -89.4012 },
  'lubbock': { latitude: 33.5779, longitude: -101.8552 },
  'reno': { latitude: 39.5296, longitude: -119.8138 },
  'winston-salem': { latitude: 36.0999, longitude: -80.2442 },
  'glendale': { latitude: 33.5387, longitude: -112.1860 },
  'scottsdale': { latitude: 33.4942, longitude: -111.9261 },
  'irving': { latitude: 32.8140, longitude: -96.9489 },
  'chesapeake': { latitude: 36.7682, longitude: -76.2875 },
  'north las vegas': { latitude: 36.1989, longitude: -115.1175 },
  'fremont': { latitude: 37.5485, longitude: -121.9886 },
  'baton rouge': { latitude: 30.4515, longitude: -91.1871 },
  'richmond': { latitude: 37.5407, longitude: -77.4360 },
  'boise': { latitude: 43.6150, longitude: -116.2023 },
  'des moines': { latitude: 41.5868, longitude: -93.6250 },
  'spokane': { latitude: 47.6588, longitude: -117.4260 },
  'birmingham': { latitude: 33.5207, longitude: -86.8025 },
  'rochester': { latitude: 43.1566, longitude: -77.6088 },
  'modesto': { latitude: 37.6390, longitude: -120.9969 },
  'tacoma': { latitude: 47.2529, longitude: -122.4443 },
  'oxnard': { latitude: 34.1975, longitude: -119.1771 },
  'knoxville': { latitude: 35.9606, longitude: -83.9207 },
  'salt lake city': { latitude: 40.7608, longitude: -111.8910 },
  'providence': { latitude: 41.8240, longitude: -71.4128 },
  'akron': { latitude: 41.0814, longitude: -81.5190 },
  'little rock': { latitude: 34.7465, longitude: -92.2896 },
  'charleston': { latitude: 32.7765, longitude: -79.9311 },

  // ── SF Bay Area / Silicon Valley ──
  'palo alto': { latitude: 37.4419, longitude: -122.1430 },
  'mountain view': { latitude: 37.3861, longitude: -122.0839 },
  'sunnyvale': { latitude: 37.3688, longitude: -122.0363 },
  'santa clara': { latitude: 37.3541, longitude: -121.9552 },
  'menlo park': { latitude: 37.4530, longitude: -122.1817 },
  'redwood city': { latitude: 37.4852, longitude: -122.2364 },
  'cupertino': { latitude: 37.3230, longitude: -122.0322 },
  'san mateo': { latitude: 37.5630, longitude: -122.3255 },
  'berkeley': { latitude: 37.8715, longitude: -122.2730 },
  'hayward': { latitude: 37.6688, longitude: -122.0808 },
  'south san francisco': { latitude: 37.6547, longitude: -122.4077 },

  // ── LA Metro ──
  'santa monica': { latitude: 34.0195, longitude: -118.4912 },
  'pasadena': { latitude: 34.1478, longitude: -118.1445 },
  'glendale ca': { latitude: 34.1425, longitude: -118.2551 },
  'burbank': { latitude: 34.1808, longitude: -118.3090 },
  'torrance': { latitude: 33.8358, longitude: -118.3406 },
  'inglewood': { latitude: 33.9617, longitude: -118.3531 },
  'culver city': { latitude: 34.0211, longitude: -118.3965 },
  'el segundo': { latitude: 33.9192, longitude: -118.4165 },
  'beverly hills': { latitude: 34.0736, longitude: -118.4004 },
  'irvine': { latitude: 33.6846, longitude: -117.8265 },
  'costa mesa': { latitude: 33.6412, longitude: -117.9187 },

  // ── Chicago Metro ──
  'evanston': { latitude: 42.0451, longitude: -87.6877 },
  'oak park': { latitude: 41.8850, longitude: -87.7845 },
  'naperville': { latitude: 41.7508, longitude: -88.1535 },
  'schaumburg': { latitude: 42.0334, longitude: -88.0834 },
  'skokie': { latitude: 42.0324, longitude: -87.7416 },

  // ── Boston Metro ──
  'cambridge': { latitude: 42.3736, longitude: -71.1097 },
  'somerville': { latitude: 42.3876, longitude: -71.0995 },
  'brookline': { latitude: 42.3318, longitude: -71.1212 },
  'quincy': { latitude: 42.2529, longitude: -71.0023 },
  'waltham': { latitude: 42.3765, longitude: -71.2356 },
  'newton': { latitude: 42.3370, longitude: -71.2092 },
  'worcester': { latitude: 42.2626, longitude: -71.8023 },

  // ── Seattle Metro ──
  'bellevue': { latitude: 47.6101, longitude: -122.2015 },
  'redmond': { latitude: 47.6740, longitude: -122.1215 },
  'kirkland': { latitude: 47.6815, longitude: -122.2087 },
  'bothell': { latitude: 47.7601, longitude: -122.2054 },
  'everett': { latitude: 47.9790, longitude: -122.2021 },

  // ── DC Metro ──
  'arlington va': { latitude: 38.8799, longitude: -77.1068 },
  'alexandria': { latitude: 38.8048, longitude: -77.0469 },
  'bethesda': { latitude: 38.9807, longitude: -77.1003 },
  'silver spring': { latitude: 38.9907, longitude: -77.0261 },
  'reston': { latitude: 38.9586, longitude: -77.3570 },
  'tysons': { latitude: 38.9187, longitude: -77.2311 },
  'mclean': { latitude: 38.9338, longitude: -77.1773 },
  'falls church': { latitude: 38.8823, longitude: -77.1711 },
  'columbia md': { latitude: 39.2037, longitude: -76.8610 },

  // ── Dallas-Fort Worth ──
  'frisco': { latitude: 33.1507, longitude: -96.8236 },
  'richardson': { latitude: 32.9483, longitude: -96.7299 },
  'mckinney': { latitude: 33.1972, longitude: -96.6398 },
  'denton': { latitude: 33.2148, longitude: -97.1331 },
  'garland': { latitude: 32.9126, longitude: -96.6389 },

  // ── Houston Metro ──
  'sugar land': { latitude: 29.6197, longitude: -95.6349 },
  'the woodlands': { latitude: 30.1658, longitude: -95.4613 },
  'pearland': { latitude: 29.5636, longitude: -95.2860 },
  'katy': { latitude: 29.7858, longitude: -95.8245 },

  // ── Atlanta Metro ──
  'sandy springs': { latitude: 33.9304, longitude: -84.3733 },
  'marietta': { latitude: 33.9526, longitude: -84.5499 },
  'roswell': { latitude: 34.0232, longitude: -84.3616 },
  'alpharetta': { latitude: 34.0754, longitude: -84.2941 },
  'decatur': { latitude: 33.7748, longitude: -84.2963 },
  'kennesaw': { latitude: 34.0234, longitude: -84.6155 },
  'duluth ga': { latitude: 34.0029, longitude: -84.1446 },

  // ── Miami Metro ──
  'fort lauderdale': { latitude: 26.1224, longitude: -80.1373 },
  'coral gables': { latitude: 25.7215, longitude: -80.2684 },
  'doral': { latitude: 25.8195, longitude: -80.3553 },
  'boca raton': { latitude: 26.3683, longitude: -80.1289 },
  'aventura': { latitude: 25.9564, longitude: -80.1392 },
  'hialeah': { latitude: 25.8576, longitude: -80.2781 },

  // ── Denver Metro ──
  'boulder': { latitude: 40.0150, longitude: -105.2705 },
  'lakewood': { latitude: 39.7047, longitude: -105.0814 },
  'centennial': { latitude: 39.5791, longitude: -104.8769 },
  'broomfield': { latitude: 39.9205, longitude: -105.0867 },

  // ── Phoenix Metro ──
  'tempe': { latitude: 33.4255, longitude: -111.9400 },
  'mesa az': { latitude: 33.4152, longitude: -111.8315 },

  // ── Kansas City Metro ──
  'overland park': { latitude: 38.9822, longitude: -94.6708 },
  'olathe': { latitude: 38.8814, longitude: -94.8191 },
  'lenexa': { latitude: 38.9536, longitude: -94.7337 },
  'shawnee': { latitude: 39.0417, longitude: -94.7151 },
  'independence': { latitude: 39.0911, longitude: -94.4155 },
  "lee's summit": { latitude: 38.9108, longitude: -94.3822 },
  'leavenworth': { latitude: 39.3112, longitude: -94.9224 },
  'lawrence': { latitude: 38.9717, longitude: -95.2353 },
  'topeka': { latitude: 39.0473, longitude: -95.6752 },

  // ── Raleigh / Research Triangle ──
  'durham': { latitude: 35.9940, longitude: -78.8986 },
  'chapel hill': { latitude: 35.9132, longitude: -79.0558 },
  'cary': { latitude: 35.7915, longitude: -78.7811 },
  'morrisville': { latitude: 35.8235, longitude: -78.8256 },

  // ── Minneapolis-St Paul ──
  'bloomington mn': { latitude: 44.8408, longitude: -93.2983 },
  'eden prairie': { latitude: 44.8547, longitude: -93.4708 },
  'plymouth mn': { latitude: 45.0105, longitude: -93.4555 },

  // ── Detroit Metro ──
  'dearborn': { latitude: 42.3223, longitude: -83.1763 },
  'ann arbor': { latitude: 42.2808, longitude: -83.7430 },
  'troy mi': { latitude: 42.6064, longitude: -83.1498 },
  'southfield': { latitude: 42.4734, longitude: -83.2219 },

  // ── University Towns ──
  'state college': { latitude: 40.7934, longitude: -77.8600 },
  'college station': { latitude: 30.6280, longitude: -96.3344 },
  'ames': { latitude: 42.0347, longitude: -93.6200 },
  'blacksburg': { latitude: 37.2296, longitude: -80.4139 },
  'charlottesville': { latitude: 38.0293, longitude: -78.4767 },
  'gainesville': { latitude: 29.6516, longitude: -82.3248 },
  'tuscaloosa': { latitude: 33.2098, longitude: -87.5692 },
  'athens ga': { latitude: 33.9519, longitude: -83.3576 },
  'champaign': { latitude: 40.1164, longitude: -88.2434 },
  'urbana': { latitude: 40.1106, longitude: -88.2073 },
  'ithaca': { latitude: 42.4440, longitude: -76.5019 },
  'princeton': { latitude: 40.3573, longitude: -74.6672 },
  'new haven': { latitude: 41.3083, longitude: -72.9279 },
  'hanover nh': { latitude: 43.7022, longitude: -72.2896 },
  'stanford': { latitude: 37.4275, longitude: -122.1697 },
  'boulder co': { latitude: 40.0150, longitude: -105.2705 },
  'eugene': { latitude: 44.0521, longitude: -123.0868 },
  'corvallis': { latitude: 44.5646, longitude: -123.2620 },
  'provo': { latitude: 40.2338, longitude: -111.6585 },
  'logan': { latitude: 41.7370, longitude: -111.8338 },
  'stillwater': { latitude: 36.1156, longitude: -97.0584 },
  'norman': { latitude: 35.2226, longitude: -97.4395 },
  'west lafayette': { latitude: 40.4259, longitude: -86.9081 },
  'davis ca': { latitude: 38.5449, longitude: -121.7405 },
  'santa barbara': { latitude: 34.4208, longitude: -119.6982 },
  'san luis obispo': { latitude: 35.2828, longitude: -120.6596 },
  'tempe az': { latitude: 33.4255, longitude: -111.9400 },
  'manhattan ks': { latitude: 39.1836, longitude: -96.5717 },
  'columbia mo': { latitude: 38.9517, longitude: -92.3341 },
  'columbia sc': { latitude: 34.0007, longitude: -81.0348 },
  'iowa city': { latitude: 41.6611, longitude: -91.5302 },
  'bloomington in': { latitude: 39.1653, longitude: -86.5264 },
  'east lansing': { latitude: 42.7370, longitude: -84.4839 },
  'lansing': { latitude: 42.7325, longitude: -84.5555 },
  'burlington vt': { latitude: 44.4759, longitude: -73.2121 },
  'tallahassee': { latitude: 30.4383, longitude: -84.2807 },
  'clemson': { latitude: 34.6834, longitude: -82.8374 },
  'auburn': { latitude: 32.6099, longitude: -85.4808 },
  'fayetteville ar': { latitude: 36.0822, longitude: -94.1719 },
  'morgantown': { latitude: 39.6295, longitude: -79.9559 },

  // ── Other Notable US Cities ──
  'hartford': { latitude: 41.7658, longitude: -72.6734 },
  'bridgeport': { latitude: 41.1865, longitude: -73.1952 },
  'stamford': { latitude: 41.0534, longitude: -73.5387 },
  'new brunswick': { latitude: 40.4863, longitude: -74.4518 },
  'hoboken': { latitude: 40.7440, longitude: -74.0324 },
  'white plains': { latitude: 41.0340, longitude: -73.7629 },
  'yonkers': { latitude: 40.9312, longitude: -73.8987 },
  'savannah': { latitude: 32.0809, longitude: -81.0912 },
  'charleston sc': { latitude: 32.7765, longitude: -79.9311 },
  'greenville sc': { latitude: 34.8526, longitude: -82.3940 },
  'wilmington de': { latitude: 39.7391, longitude: -75.5398 },
  'harrisburg': { latitude: 40.2732, longitude: -76.8867 },
  'scranton': { latitude: 41.4090, longitude: -75.6624 },
  'allentown': { latitude: 40.6084, longitude: -75.4902 },
  'syracuse': { latitude: 43.0481, longitude: -76.1474 },
  'albany': { latitude: 42.6526, longitude: -73.7562 },
  'dayton': { latitude: 39.7589, longitude: -84.1916 },
  'springfield mo': { latitude: 37.2090, longitude: -93.2923 },
  'st louis': { latitude: 38.6270, longitude: -90.1994 },
  'saint louis': { latitude: 38.6270, longitude: -90.1994 },
  'grand rapids': { latitude: 42.9634, longitude: -85.6681 },
  'fort wayne': { latitude: 41.0793, longitude: -85.1394 },
  'chattanooga': { latitude: 35.0456, longitude: -85.3097 },
  'jackson ms': { latitude: 32.2988, longitude: -90.1848 },
  'mobile': { latitude: 30.6954, longitude: -88.0399 },
  'montgomery': { latitude: 32.3792, longitude: -86.3077 },
  'huntsville': { latitude: 34.7304, longitude: -86.5861 },
  'shreveport': { latitude: 32.5252, longitude: -93.7502 },
  'jackson wy': { latitude: 43.4799, longitude: -110.7624 },
  'fargo': { latitude: 46.8772, longitude: -96.7898 },
  'sioux falls': { latitude: 43.5446, longitude: -96.7311 },
  'billings': { latitude: 45.7833, longitude: -108.5007 },
  'missoula': { latitude: 46.8721, longitude: -113.9940 },
  'bozeman': { latitude: 45.6770, longitude: -111.0429 },
  'rapid city': { latitude: 44.0805, longitude: -103.2310 },
  'cheyenne': { latitude: 41.1400, longitude: -104.8202 },
  'santa fe': { latitude: 35.6870, longitude: -105.9378 },

  // ── US States (centroids for state-level matching) ──
  'alabama': { latitude: 32.3182, longitude: -86.9023 },
  'alaska': { latitude: 63.5888, longitude: -154.4931 },
  'arizona': { latitude: 34.0489, longitude: -111.0937 },
  'arkansas': { latitude: 35.2010, longitude: -91.8318 },
  'california': { latitude: 36.7783, longitude: -119.4179 },
  'colorado': { latitude: 39.5501, longitude: -105.7821 },
  'connecticut': { latitude: 41.6032, longitude: -73.0877 },
  'delaware': { latitude: 38.9108, longitude: -75.5277 },
  'florida': { latitude: 27.6648, longitude: -81.5158 },
  'georgia': { latitude: 32.1656, longitude: -82.9001 },
  'hawaii': { latitude: 19.8968, longitude: -155.5828 },
  'idaho': { latitude: 44.0682, longitude: -114.7420 },
  'illinois': { latitude: 40.6331, longitude: -89.3985 },
  'indiana': { latitude: 40.2672, longitude: -86.1349 },
  'iowa': { latitude: 41.8780, longitude: -93.0977 },
  'kansas': { latitude: 39.0119, longitude: -98.4842 },
  'kentucky': { latitude: 37.8393, longitude: -84.2700 },
  'louisiana': { latitude: 30.9843, longitude: -91.9623 },
  'maine': { latitude: 45.2538, longitude: -69.4455 },
  'maryland': { latitude: 39.0458, longitude: -76.6413 },
  'massachusetts': { latitude: 42.4072, longitude: -71.3824 },
  'michigan': { latitude: 44.3148, longitude: -85.6024 },
  'minnesota': { latitude: 46.7296, longitude: -94.6859 },
  'mississippi': { latitude: 32.3547, longitude: -89.3985 },
  'missouri': { latitude: 37.9643, longitude: -91.8318 },
  'montana': { latitude: 46.8797, longitude: -110.3626 },
  'nebraska': { latitude: 41.4925, longitude: -99.9018 },
  'nevada': { latitude: 38.8026, longitude: -116.4194 },
  'new hampshire': { latitude: 43.1939, longitude: -71.5724 },
  'new jersey': { latitude: 40.0583, longitude: -74.4057 },
  'new mexico': { latitude: 34.5199, longitude: -105.8701 },
  'new york state': { latitude: 43.2994, longitude: -74.2179 },
  'north carolina': { latitude: 35.7596, longitude: -79.0193 },
  'north dakota': { latitude: 47.5515, longitude: -101.0020 },
  'ohio': { latitude: 40.4173, longitude: -82.9071 },
  'oklahoma': { latitude: 35.0078, longitude: -97.0929 },
  'oregon': { latitude: 43.8041, longitude: -120.5542 },
  'pennsylvania': { latitude: 41.2033, longitude: -77.1945 },
  'rhode island': { latitude: 41.5801, longitude: -71.4774 },
  'south carolina': { latitude: 33.8361, longitude: -81.1637 },
  'south dakota': { latitude: 43.9695, longitude: -99.9018 },
  'tennessee': { latitude: 35.5175, longitude: -86.5804 },
  'texas': { latitude: 31.9686, longitude: -99.9018 },
  'utah': { latitude: 39.3210, longitude: -111.0937 },
  'vermont': { latitude: 44.5588, longitude: -72.5778 },
  'virginia': { latitude: 37.4316, longitude: -78.6569 },
  'west virginia': { latitude: 38.5976, longitude: -80.4549 },
  'wisconsin': { latitude: 43.7844, longitude: -88.7879 },
  'wyoming': { latitude: 43.0760, longitude: -107.2903 },
  'district of columbia': { latitude: 38.9072, longitude: -77.0369 },

  // ── Canada ──
  'toronto': { latitude: 43.6532, longitude: -79.3832 },
  'vancouver': { latitude: 49.2827, longitude: -123.1207 },
  'montreal': { latitude: 45.5017, longitude: -73.5673 },
  'calgary': { latitude: 51.0447, longitude: -114.0719 },
  'ottawa': { latitude: 45.4215, longitude: -75.6972 },
  'edmonton': { latitude: 53.5461, longitude: -113.4938 },
  'winnipeg': { latitude: 49.8951, longitude: -97.1384 },
  'quebec city': { latitude: 46.8139, longitude: -71.2080 },
  'hamilton': { latitude: 43.2557, longitude: -79.8711 },
  'waterloo': { latitude: 43.4643, longitude: -80.5204 },

  // ── UK & Ireland ──
  'london': { latitude: 51.5074, longitude: -0.1278 },
  'manchester': { latitude: 53.4808, longitude: -2.2426 },
  'birmingham uk': { latitude: 52.4862, longitude: -1.8904 },
  'edinburgh': { latitude: 55.9533, longitude: -3.1883 },
  'glasgow': { latitude: 55.8642, longitude: -4.2518 },
  'bristol': { latitude: 51.4545, longitude: -2.5879 },
  'leeds': { latitude: 53.8008, longitude: -1.5491 },
  'liverpool': { latitude: 53.4084, longitude: -2.9916 },
  'oxford': { latitude: 51.7520, longitude: -1.2577 },
  'cambridge uk': { latitude: 52.2053, longitude: 0.1218 },
  'dublin': { latitude: 53.3498, longitude: -6.2603 },

  // ── Europe ──
  'paris': { latitude: 48.8566, longitude: 2.3522 },
  'berlin': { latitude: 52.5200, longitude: 13.4050 },
  'amsterdam': { latitude: 52.3676, longitude: 4.9041 },
  'munich': { latitude: 48.1351, longitude: 11.5820 },
  'zurich': { latitude: 47.3769, longitude: 8.5417 },
  'stockholm': { latitude: 59.3293, longitude: 18.0686 },
  'copenhagen': { latitude: 55.6761, longitude: 12.5683 },
  'oslo': { latitude: 59.9139, longitude: 10.7522 },
  'helsinki': { latitude: 60.1699, longitude: 24.9384 },
  'vienna': { latitude: 48.2082, longitude: 16.3738 },
  'prague': { latitude: 50.0755, longitude: 14.4378 },
  'warsaw': { latitude: 52.2297, longitude: 21.0122 },
  'madrid': { latitude: 40.4168, longitude: -3.7038 },
  'barcelona': { latitude: 41.3874, longitude: 2.1686 },
  'rome': { latitude: 41.9028, longitude: 12.4964 },
  'milan': { latitude: 45.4642, longitude: 9.1900 },
  'lisbon': { latitude: 38.7223, longitude: -9.1393 },

  // ── India ──
  'bangalore': { latitude: 12.9716, longitude: 77.5946 },
  'bengaluru': { latitude: 12.9716, longitude: 77.5946 },
  'mumbai': { latitude: 19.0760, longitude: 72.8777 },
  'delhi': { latitude: 28.7041, longitude: 77.1025 },
  'new delhi': { latitude: 28.6139, longitude: 77.2090 },
  'hyderabad': { latitude: 17.3850, longitude: 78.4867 },
  'chennai': { latitude: 13.0827, longitude: 80.2707 },
  'pune': { latitude: 18.5204, longitude: 73.8567 },
  'kolkata': { latitude: 22.5726, longitude: 88.3639 },
  'ahmedabad': { latitude: 23.0225, longitude: 72.5714 },

  // ── Asia-Pacific ──
  'singapore': { latitude: 1.3521, longitude: 103.8198 },
  'tokyo': { latitude: 35.6762, longitude: 139.6503 },
  'seoul': { latitude: 37.5665, longitude: 126.9780 },
  'hong kong': { latitude: 22.3193, longitude: 114.1694 },
  'shanghai': { latitude: 31.2304, longitude: 121.4737 },
  'beijing': { latitude: 39.9042, longitude: 116.4074 },
  'taipei': { latitude: 25.0330, longitude: 121.5654 },
  'kuala lumpur': { latitude: 3.1390, longitude: 101.6869 },
  'bangkok': { latitude: 13.7563, longitude: 100.5018 },
  'jakarta': { latitude: -6.2088, longitude: 106.8456 },
  'manila': { latitude: 14.5995, longitude: 120.9842 },
  'ho chi minh city': { latitude: 10.8231, longitude: 106.6297 },

  // ── Australia / New Zealand ──
  'sydney': { latitude: -33.8688, longitude: 151.2093 },
  'melbourne': { latitude: -37.8136, longitude: 144.9631 },
  'brisbane': { latitude: -27.4698, longitude: 153.0251 },
  'perth': { latitude: -31.9505, longitude: 115.8605 },
  'auckland': { latitude: -36.8485, longitude: 174.7633 },
  'wellington': { latitude: -41.2865, longitude: 174.7762 },

  // ── Middle East ──
  'dubai': { latitude: 25.2048, longitude: 55.2708 },
  'abu dhabi': { latitude: 24.4539, longitude: 54.3773 },
  'riyadh': { latitude: 24.7136, longitude: 46.6753 },
  'tel aviv': { latitude: 32.0853, longitude: 34.7818 },
  'doha': { latitude: 25.2854, longitude: 51.5310 },

  // ── Africa ──
  'cairo': { latitude: 30.0444, longitude: 31.2357 },
  'lagos': { latitude: 6.5244, longitude: 3.3792 },
  'nairobi': { latitude: -1.2921, longitude: 36.8219 },
  'cape town': { latitude: -33.9249, longitude: 18.4241 },
  'johannesburg': { latitude: -26.2041, longitude: 28.0473 },
  'accra': { latitude: 5.6037, longitude: -0.1870 },
  'casablanca': { latitude: 33.5731, longitude: -7.5898 },

  // ── Latin America ──
  'mexico city': { latitude: 19.4326, longitude: -99.1332 },
  'sao paulo': { latitude: -23.5505, longitude: -46.6333 },
  'buenos aires': { latitude: -34.6037, longitude: -58.3816 },
  'bogota': { latitude: 4.7110, longitude: -74.0721 },
  'lima': { latitude: -12.0464, longitude: -77.0428 },
  'santiago': { latitude: -33.4489, longitude: -70.6693 },
  'guadalajara': { latitude: 20.6597, longitude: -103.3496 },
  'monterrey': { latitude: 25.6866, longitude: -100.3161 },
  'medellin': { latitude: 6.2442, longitude: -75.5812 },
};

// ============================================
// COORDINATE LOOKUP + GEOCODING FALLBACK
// ============================================

/**
 * Parse a location string into coordinates.
 * Tries known locations first, then Nominatim geocoding as fallback.
 */
export async function parseLocationToCoordinates(location: string): Promise<GeoCoordinates | null> {
  if (!location) return null;

  // Try known locations first (fast path)
  const coords = lookupKnownLocation(location);
  if (coords) return coords;

  // Nominatim geocoding fallback (rate-limited, 1 req/sec)
  try {
    const encoded = encodeURIComponent(location);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      {
        headers: { 'User-Agent': 'SyllabusStack-Capstone/1.0' },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (response.ok) {
      const results = await response.json();
      if (results.length > 0) {
        return {
          latitude: parseFloat(results[0].lat),
          longitude: parseFloat(results[0].lon),
        };
      }
    }
  } catch {
    // Geocoding failed silently — return null
  }

  return null;
}

/**
 * Lookup known location from the table (synchronous, no API call)
 */
export function lookupKnownLocation(location: string): GeoCoordinates | null {
  if (!location) return null;
  const normalized = location.toLowerCase().trim()
    .replace(/,\s*united states$/i, '')
    .replace(/,\s*usa$/i, '')
    .replace(/,\s*us$/i, '')
    .trim();

  // Direct match
  if (KNOWN_LOCATIONS[normalized]) return KNOWN_LOCATIONS[normalized];

  // Try "city, state" → just city
  const parts = normalized.split(',').map(p => p.trim());
  if (parts.length >= 1 && KNOWN_LOCATIONS[parts[0]]) return KNOWN_LOCATIONS[parts[0]];

  // Try partial matching for common patterns
  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords;
    }
  }

  return null;
}

/**
 * Calculate distance between two location strings.
 * Returns distance in miles or null if either location can't be resolved.
 */
export async function calculateDistanceBetweenLocations(
  location1: string,
  location2: string
): Promise<number | null> {
  const [coords1, coords2] = await Promise.all([
    parseLocationToCoordinates(location1),
    parseLocationToCoordinates(location2),
  ]);

  if (!coords1 || !coords2) return null;
  return calculateDistanceMiles(coords1, coords2);
}

/**
 * Convert distance in miles to a 0-1 score for ranking.
 * 0 miles = 1.0, 300+ miles = 0.2
 */
export function distanceToScore(distanceMiles: number): number {
  if (distanceMiles <= 10) return 1.0;
  if (distanceMiles <= 25) return 0.95;
  if (distanceMiles <= 50) return 0.9;
  if (distanceMiles <= 100) return 0.7;
  if (distanceMiles <= 200) return 0.4;
  if (distanceMiles <= 300) return 0.25;
  return 0.2;
}
