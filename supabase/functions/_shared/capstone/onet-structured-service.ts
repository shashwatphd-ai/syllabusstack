/**
 * O*NET Structured Data Service
 *
 * PHASE 2 of the pipeline: Map skills to occupations with STRUCTURED data.
 *
 * CRITICAL: This module preserves DWAs, technologies, and industries as
 * structured data. It does NOT flatten them to keywords.
 *
 * The structured data is used for:
 * - DWAs: Semantic matching in Phase 4
 * - Technologies: Apollo technology filter in Phase 3
 * - Industries: Company filtering in Phase 3
 *
 * Ported from projectify-syllabus. Uses onet-service.ts auth patterns
 * (Basic auth with ONET_USERNAME/ONET_PASSWORD env vars, 30-day cache).
 */

import type {
  LightcastSkillId,
  DetailedWorkActivity,
  OccupationTechnology,
  MappedOccupation,
  OccupationMappingInput,
  OccupationMappingOutput
} from './pipeline-types.ts';

// Import the existing SOC mapping (curated discipline -> SOC codes)
import { mapCourseToSOC, type SOCMapping } from './course-soc-mapping.ts';

// Configuration — matches onet-service.ts patterns
const ONET_API_BASE = 'https://services.onetcenter.org/ws/online';

// Cache for O*NET data (30-day TTL - O*NET updates annually)
// Mirrors the caching strategy in onet-service.ts
const onetCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Apollo Technology UID mapping
 * Maps O*NET technology names to Apollo's technology_uids
 *
 * These UIDs are used in Apollo's currently_using_any_of_technology_uids filter
 *
 * NOTE: This mapping needs to be built from Apollo's API or documentation.
 * For now, using placeholder UIDs - replace with actual Apollo UIDs.
 */
const TECHNOLOGY_TO_APOLLO_UID: Record<string, string> = {
  // CAD Software
  'solidworks': '5c1042a6c9e77c0001dda6f4',
  'autocad': '5c1042a6c9e77c0001dda6f5',
  'catia': '5c1042a6c9e77c0001dda6f6',
  'inventor': '5c1042a6c9e77c0001dda6f7',
  'creo': '5c1042a6c9e77c0001dda6f8',

  // Simulation & Analysis
  'ansys': '5c1042a6c9e77c0001dda700',
  'matlab': '5c1042a6c9e77c0001dda701',
  'simulink': '5c1042a6c9e77c0001dda702',
  'abaqus': '5c1042a6c9e77c0001dda703',
  'comsol': '5c1042a6c9e77c0001dda704',

  // Programming Languages
  'python': '5c1042a6c9e77c0001dda710',
  'java': '5c1042a6c9e77c0001dda711',
  'javascript': '5c1042a6c9e77c0001dda712',
  'c++': '5c1042a6c9e77c0001dda713',
  'sql': '5c1042a6c9e77c0001dda714',

  // Data & Analytics
  'tableau': '5c1042a6c9e77c0001dda720',
  'power bi': '5c1042a6c9e77c0001dda721',
  'excel': '5c1042a6c9e77c0001dda722',
  'r': '5c1042a6c9e77c0001dda723',

  // Cloud & DevOps
  'aws': '5c1042a6c9e77c0001dda730',
  'azure': '5c1042a6c9e77c0001dda731',
  'docker': '5c1042a6c9e77c0001dda732',
  'kubernetes': '5c1042a6c9e77c0001dda733',

  // Add more as needed...
};

/**
 * Get O*NET credentials from environment
 * Follows the same pattern as onet-service.ts (ONET_USERNAME / ONET_PASSWORD)
 */
function getOnetCredentials(): { username: string; password: string } | null {
  const username = Deno.env.get('ONET_USERNAME');
  const password = Deno.env.get('ONET_PASSWORD');

  if (!username || !password) {
    console.warn('O*NET credentials not configured. Using fallback data.');
    return null;
  }

  return { username, password };
}

/**
 * Make authenticated request to O*NET API
 * Uses Basic auth matching onet-service.ts: btoa(`${username}:${password}`)
 */
async function onetRequest(endpoint: string, credentials: { username: string; password: string }): Promise<unknown> {
  const url = `${ONET_API_BASE}${endpoint}`;
  const auth = btoa(`${credentials.username}:${credentials.password}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'User-Agent': 'SyllabusStack/1.0',
    }
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    if (response.status === 429) {
      console.warn('  O*NET rate limit exceeded');
      return null;
    }
    throw new Error(`O*NET API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get cached O*NET data or null if cache miss/expired
 */
function getCached(key: string): unknown | null {
  const cached = onetCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

/**
 * Cache O*NET data
 */
function setCache(key: string, data: unknown): void {
  onetCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Fetch DWAs for an occupation from O*NET
 *
 * CRITICAL: Returns FULL DWA descriptions, not keywords
 */
async function fetchDWAs(
  socCode: string,
  credentials: { username: string; password: string } | null
): Promise<DetailedWorkActivity[]> {
  const cacheKey = `dwa:${socCode}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as DetailedWorkActivity[];

  if (!credentials) {
    // Fallback: Use curated DWAs from SOC mapping
    return getFallbackDWAs(socCode);
  }

  try {
    const data = await onetRequest(`/occupations/${socCode}/detailed_work_activities`, credentials) as {
      activity?: Array<{
        id: string;
        name: string;
        importance?: { value: number };
        level?: { value: number };
      }>;
    } | null;

    if (!data) return getFallbackDWAs(socCode);

    const dwas: DetailedWorkActivity[] = (data.activity || []).map((item) => ({
      id: item.id,
      name: item.name,  // FULL description, not split into words!
      importance: item.importance?.value || 50,
      level: item.level?.value || 3
    }));

    setCache(cacheKey, dwas);
    return dwas;
  } catch (error) {
    console.warn(`Could not fetch DWAs for ${socCode}: ${error}`);
    return getFallbackDWAs(socCode);
  }
}

/**
 * Fetch technologies for an occupation from O*NET
 */
async function fetchTechnologies(
  socCode: string,
  credentials: { username: string; password: string } | null
): Promise<OccupationTechnology[]> {
  const cacheKey = `tech:${socCode}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as OccupationTechnology[];

  if (!credentials) {
    return getFallbackTechnologies(socCode);
  }

  try {
    const data = await onetRequest(`/occupations/${socCode}/technology_skills`, credentials) as {
      technology?: Array<{
        name: string;
        category?: { name: string };
      }>;
    } | null;

    if (!data) return getFallbackTechnologies(socCode);

    const technologies: OccupationTechnology[] = (data.technology || []).map((item) => {
      const name = item.name?.toLowerCase() || '';
      return {
        name: item.name,
        category: item.category?.name || 'General',
        apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID[name] || undefined
      };
    });

    setCache(cacheKey, technologies);
    return technologies;
  } catch (error) {
    console.warn(`Could not fetch technologies for ${socCode}: ${error}`);
    return getFallbackTechnologies(socCode);
  }
}

/**
 * Fallback DWAs based on SOC major group
 */
function getFallbackDWAs(socCode: string): DetailedWorkActivity[] {
  const majorGroup = socCode.substring(0, 2);

  const fallbackDWAs: Record<string, DetailedWorkActivity[]> = {
    '17': [ // Engineering
      { id: 'dwa-1', name: 'Design and develop engineering solutions to technical problems', importance: 85, level: 5 },
      { id: 'dwa-2', name: 'Analyze system requirements and design specifications', importance: 80, level: 5 },
      { id: 'dwa-3', name: 'Conduct tests and evaluations of systems and components', importance: 75, level: 4 },
      { id: 'dwa-4', name: 'Prepare technical reports and documentation', importance: 70, level: 4 }
    ],
    '15': [ // Computer & IT
      { id: 'dwa-1', name: 'Design and develop software applications and systems', importance: 85, level: 5 },
      { id: 'dwa-2', name: 'Analyze user requirements and system specifications', importance: 80, level: 5 },
      { id: 'dwa-3', name: 'Test and debug software to ensure functionality', importance: 75, level: 4 },
      { id: 'dwa-4', name: 'Document technical specifications and procedures', importance: 70, level: 4 }
    ],
    '13': [ // Business & Finance
      { id: 'dwa-1', name: 'Analyze financial data and prepare reports', importance: 85, level: 5 },
      { id: 'dwa-2', name: 'Develop business strategies and recommendations', importance: 80, level: 5 },
      { id: 'dwa-3', name: 'Evaluate investment opportunities and risks', importance: 75, level: 4 },
      { id: 'dwa-4', name: 'Prepare presentations for stakeholders', importance: 70, level: 4 }
    ],
    '11': [ // Management
      { id: 'dwa-1', name: 'Develop and implement strategic plans and objectives', importance: 85, level: 5 },
      { id: 'dwa-2', name: 'Coordinate activities across departments and teams', importance: 80, level: 5 },
      { id: 'dwa-3', name: 'Analyze operational data to improve efficiency', importance: 75, level: 4 },
      { id: 'dwa-4', name: 'Lead and mentor staff to achieve goals', importance: 70, level: 4 }
    ]
  };

  return fallbackDWAs[majorGroup] || fallbackDWAs['17'];
}

/**
 * Fallback technologies based on SOC code
 */
function getFallbackTechnologies(socCode: string): OccupationTechnology[] {
  const majorGroup = socCode.substring(0, 2);

  const fallbackTech: Record<string, OccupationTechnology[]> = {
    '17': [ // Engineering
      { name: 'SolidWorks', category: 'CAD', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['solidworks'] },
      { name: 'AutoCAD', category: 'CAD', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['autocad'] },
      { name: 'MATLAB', category: 'Analysis', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['matlab'] },
      { name: 'ANSYS', category: 'Simulation', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['ansys'] }
    ],
    '15': [ // Computer & IT
      { name: 'Python', category: 'Programming', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['python'] },
      { name: 'JavaScript', category: 'Programming', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['javascript'] },
      { name: 'SQL', category: 'Database', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['sql'] },
      { name: 'AWS', category: 'Cloud', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['aws'] }
    ],
    '13': [ // Business & Finance
      { name: 'Excel', category: 'Spreadsheet', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['excel'] },
      { name: 'Tableau', category: 'Analytics', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['tableau'] },
      { name: 'Power BI', category: 'Analytics', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['power bi'] },
      { name: 'SQL', category: 'Database', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['sql'] }
    ],
    '11': [ // Management
      { name: 'Excel', category: 'Spreadsheet', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['excel'] },
      { name: 'Power BI', category: 'Analytics', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['power bi'] },
      { name: 'SQL', category: 'Database', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['sql'] },
      { name: 'Python', category: 'Programming', apolloTechnologyUid: TECHNOLOGY_TO_APOLLO_UID['python'] }
    ]
  };

  return fallbackTech[majorGroup] || fallbackTech['17'];
}

/**
 * MAIN EXPORT: Map skills to occupations with structured data
 *
 * This is the entry point for Phase 2 of the pipeline.
 */
export async function mapSkillsToOccupations(
  input: OccupationMappingInput
): Promise<OccupationMappingOutput> {
  const startTime = Date.now();

  console.log(`\n========================================`);
  console.log(`PHASE 2: OCCUPATION MAPPING (O*NET)`);
  console.log(`========================================`);
  console.log(`Course: ${input.courseTitle}`);
  console.log(`Skills: ${input.skills.length}`);

  // Get O*NET credentials (optional - will use fallbacks if not available)
  const credentials = getOnetCredentials();
  if (credentials) {
    console.log(`O*NET API: Configured`);
  } else {
    console.log(`O*NET API: Using fallback data`);
  }

  // Step 1: Use curated SOC mapping based on course title
  // Note: mapCourseToSOC takes (courseTitle, outcomes[], courseLevel) per its signature
  const skillNames = input.skills.map(s => s.name);
  const socMappings = mapCourseToSOC(input.courseTitle, skillNames, '');

  console.log(`\nSOC Mappings:`);
  socMappings.forEach((soc: SOCMapping) => {
    console.log(`  - ${soc.socCode}: ${soc.title} (${(soc.confidence * 100).toFixed(0)}%)`);
  });

  // Step 2: Fetch structured data for each occupation
  const occupations: MappedOccupation[] = [];

  for (const soc of socMappings) {
    console.log(`\nFetching data for ${soc.socCode}...`);

    const [dwas, technologies] = await Promise.all([
      fetchDWAs(soc.socCode, credentials),
      fetchTechnologies(soc.socCode, credentials)
    ]);

    // Find skill IDs that match this occupation
    // (Simple heuristic: check if skill names appear in DWA text)
    const requiredSkillIds = input.skills
      .filter(skill => {
        const skillName = skill.name.toLowerCase();
        return dwas.some(dwa => dwa.name.toLowerCase().includes(skillName));
      })
      .map(skill => skill.id);

    occupations.push({
      socCode: soc.socCode,
      title: soc.title,
      confidence: soc.confidence,
      description: `${soc.title} - ${soc.industries.join(', ')}`,

      // STRUCTURED DATA - NOT FLATTENED
      dwas,
      technologies,
      industries: soc.industries,

      requiredSkillIds
    });

    console.log(`  DWAs: ${dwas.length}`);
    console.log(`  Technologies: ${technologies.length} (${technologies.filter(t => t.apolloTechnologyUid).length} with Apollo UIDs)`);
    console.log(`  Industries: ${soc.industries.join(', ')}`);
  }

  // Step 3: Aggregate data for Phase 3
  const allIndustries = [...new Set(occupations.flatMap(o => o.industries))];
  const allTechnologies = occupations.flatMap(o => o.technologies)
    .filter((tech, index, self) =>
      index === self.findIndex(t => t.name === tech.name)
    );
  const allDWAs = occupations.flatMap(o => o.dwas)
    .filter((dwa, index, self) =>
      index === self.findIndex(d => d.id === dwa.id)
    );

  const processingTimeMs = Date.now() - startTime;

  console.log(`\nPhase 2 Summary:`);
  console.log(`  Occupations: ${occupations.length}`);
  console.log(`  Industries: ${allIndustries.length}`);
  console.log(`  Technologies: ${allTechnologies.length}`);
  console.log(`  DWAs: ${allDWAs.length}`);
  console.log(`  Processing time: ${processingTimeMs}ms`);

  return {
    occupations,
    allIndustries,
    allTechnologies,
    allDWAs,
    processingTimeMs
  };
}
