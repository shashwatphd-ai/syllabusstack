/**
 * Apollo Industry Keyword Mapper
 * Maps SOC-derived industry terms to Apollo's actual taxonomy.
 * 
 * Solves: raw keywords like "manufacturing" return generic results;
 * Apollo needs its specific industry tags for precise company matching.
 */

import { SOCMapping } from './course-soc-mapping.ts';
import { classifyCourseDomain, CourseDomain } from './context-aware-industry-filter.ts';

// ============================================
// SOC INDUSTRY → APOLLO TAXONOMY DICTIONARY
// ============================================

const SOC_INDUSTRY_TO_APOLLO_TAXONOMY: Record<string, string[]> = {
  // ── Engineering / Manufacturing ──
  'manufacturing': ['manufacturing', 'industrial manufacturing', 'machinery manufacturing', 'metal fabrication'],
  'construction': ['construction', 'building materials', 'civil engineering', 'architecture & planning'],
  'aerospace': ['aerospace', 'aviation & aerospace', 'defense & space'],
  'automotive': ['automotive', 'motor vehicle manufacturing', 'auto parts'],
  'chemical': ['chemicals', 'chemical manufacturing', 'specialty chemicals'],
  'oil and gas': ['oil & energy', 'oil & gas', 'mining & metals', 'petroleum'],
  'mining': ['mining & metals', 'mining'],
  'utilities': ['utilities', 'electric power', 'renewables & environment'],
  'mechanical engineering': ['mechanical or industrial engineering', 'machinery', 'industrial automation'],
  'electrical engineering': ['electrical/electronic manufacturing', 'semiconductors', 'electronic manufacturing'],
  'civil engineering': ['civil engineering', 'construction', 'architecture & planning'],
  'environmental engineering': ['environmental services', 'renewables & environment', 'waste management'],
  'materials science': ['nanotechnology', 'chemicals', 'plastics', 'glass, ceramics & concrete'],
  'biomedical engineering': ['medical devices', 'biotechnology', 'hospital & health care'],
  'industrial engineering': ['industrial automation', 'mechanical or industrial engineering', 'logistics & supply chain'],

  // ── Software / Technology ──
  'software': ['computer software', 'information technology & services', 'internet'],
  'technology': ['information technology & services', 'computer software', 'computer hardware'],
  'information technology': ['information technology & services', 'computer & network security'],
  'data science': ['information technology & services', 'computer software', 'financial services'],
  'cybersecurity': ['computer & network security', 'information technology & services', 'defense & space'],
  'artificial intelligence': ['computer software', 'information technology & services'],
  'cloud computing': ['computer software', 'information technology & services', 'internet'],
  'telecommunications': ['telecommunications', 'wireless', 'computer networking'],
  'electronics': ['electrical/electronic manufacturing', 'consumer electronics', 'semiconductors'],
  'semiconductors': ['semiconductors', 'electrical/electronic manufacturing', 'nanotechnology'],

  // ── Business / Management ──
  'management': ['management consulting', 'business supplies & equipment', 'professional training & coaching'],
  'consulting': ['management consulting', 'information technology & services', 'human resources'],
  'business administration': ['management consulting', 'business supplies & equipment', 'financial services'],
  'marketing': ['marketing & advertising', 'public relations & communications', 'market research'],
  'finance': ['financial services', 'banking', 'investment management', 'venture capital & private equity'],
  'accounting': ['accounting', 'financial services'],
  'real estate': ['real estate', 'commercial real estate', 'construction'],
  'human resources': ['human resources', 'staffing & recruiting', 'professional training & coaching'],
  'supply chain': ['logistics & supply chain', 'transportation/trucking/railroad', 'warehousing'],
  'logistics': ['logistics & supply chain', 'transportation/trucking/railroad', 'maritime'],
  'operations management': ['management consulting', 'logistics & supply chain', 'industrial automation'],
  'entrepreneurship': ['venture capital & private equity', 'management consulting'],
  'international business': ['international trade & development', 'import & export'],
  'project management': ['management consulting', 'information technology & services', 'construction'],
  'strategy': ['management consulting', 'think tanks', 'program development'],
  'sales': ['marketing & advertising', 'consumer goods', 'retail'],
  'e-commerce': ['internet', 'retail', 'consumer goods'],

  // ── Healthcare / Life Sciences ──
  'healthcare': ['hospital & health care', 'medical devices', 'pharmaceuticals'],
  'nursing': ['hospital & health care', 'mental health care', 'individual & family services'],
  'pharmacy': ['pharmaceuticals', 'hospital & health care', 'biotechnology'],
  'public health': ['hospital & health care', 'government administration', 'nonprofit organization management'],
  'biotechnology': ['biotechnology', 'pharmaceuticals', 'research'],
  'medical devices': ['medical devices', 'hospital & health care', 'health, wellness & fitness'],
  'clinical research': ['research', 'pharmaceuticals', 'hospital & health care'],

  // ── Science / Research ──
  'research': ['research', 'think tanks', 'higher education'],
  'physics': ['research', 'defense & space', 'semiconductors'],
  'chemistry': ['chemicals', 'pharmaceuticals', 'research'],
  'biology': ['biotechnology', 'research', 'pharmaceuticals'],
  'agriculture': ['farming', 'food production', 'ranching'],
  'food science': ['food production', 'food & beverages', 'consumer goods'],
  'environmental science': ['environmental services', 'renewables & environment'],

  // ── Education ──
  'education': ['higher education', 'education management', 'e-learning'],
  'higher education': ['higher education', 'education management', 'research'],
  'k-12 education': ['primary/secondary education', 'education management'],

  // ── Creative / Media ──
  'design': ['design', 'graphic design', 'architecture & planning'],
  'media': ['media production', 'broadcast media', 'online media'],
  'journalism': ['media production', 'online media', 'publishing'],
  'film': ['motion pictures & film', 'entertainment', 'media production'],
  'music': ['music', 'entertainment', 'performing arts'],
  'architecture': ['architecture & planning', 'design', 'construction'],
  'graphic design': ['graphic design', 'design', 'marketing & advertising'],

  // ── Government / Nonprofit ──
  'government': ['government administration', 'government relations', 'public policy'],
  'nonprofit': ['nonprofit organization management', 'philanthropy', 'civic & social organization'],
  'social work': ['individual & family services', 'nonprofit organization management', 'mental health care'],
  'criminal justice': ['law enforcement', 'public safety', 'government administration'],

  // ── Hospitality / Services ──
  'hospitality': ['hospitality', 'restaurants', 'leisure, travel & tourism'],
  'tourism': ['leisure, travel & tourism', 'hospitality', 'airlines/aviation'],
  'sports': ['sports', 'health, wellness & fitness', 'recreational facilities & services'],
  'fitness': ['health, wellness & fitness', 'sports', 'recreational facilities & services'],

  // ── Transportation ──
  'transportation': ['transportation/trucking/railroad', 'logistics & supply chain', 'maritime'],
  'aviation': ['airlines/aviation', 'aviation & aerospace', 'defense & space'],
  'maritime': ['maritime', 'transportation/trucking/railroad', 'shipbuilding'],
};

// ── Titles to exclude for non-business courses ──
const RECRUITER_TITLES = [
  'Recruiter', 'HR Manager', 'Talent Acquisition',
  'Staffing Coordinator', 'HR Specialist', 'Headhunter',
  'Recruitment Manager', 'Sourcer', 'HR Coordinator'
];

// ============================================
// MAIN EXPORT
// ============================================

/**
 * Map SOC-derived industry keywords to Apollo taxonomy terms.
 * Returns Apollo-compatible keyword tags for company search.
 */
export function mapSOCIndustriesToApollo(
  rawIndustries: string[],
  socMappings: SOCMapping[]
): { apolloKeywords: string[]; excludeTitles: string[] } {
  const apolloKeywords = new Set<string>();
  const domain = classifyCourseDomain(socMappings).domain;

  for (const industry of rawIndustries) {
    const lower = industry.toLowerCase().trim();
    const mapped = SOC_INDUSTRY_TO_APOLLO_TAXONOMY[lower];
    if (mapped) {
      mapped.forEach(kw => apolloKeywords.add(kw));
    } else {
      // Pass through unmapped keywords as-is
      apolloKeywords.add(industry);
    }
  }

  // Context-aware title exclusions
  const excludeTitles = shouldExcludeRecruiters(domain) ? RECRUITER_TITLES : [];

  return {
    apolloKeywords: [...apolloKeywords].slice(0, 20),
    excludeTitles,
  };
}

function shouldExcludeRecruiters(domain: CourseDomain): boolean {
  return domain === 'engineering_technical' ||
    domain === 'computer_tech' ||
    domain === 'healthcare_science';
}

/**
 * Get Apollo keywords directly from SOC mappings.
 */
export function getApolloKeywordsFromSOC(socMappings: SOCMapping[]): string[] {
  const allIndustries = [...new Set(socMappings.flatMap(soc => soc.industries))];
  const { apolloKeywords } = mapSOCIndustriesToApollo(allIndustries, socMappings);
  return apolloKeywords;
}
