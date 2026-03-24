/**
 * O*NET Integration Service
 * Ported from EduThree1 — maps extracted skills to standardized occupations,
 * detailed work activities (DWAs), tools, technologies, and tasks.
 *
 * O*NET Web Services: https://services.onetcenter.org/
 * Free Tier: 1000 requests/day
 */

export interface OnetOccupation {
  code: string;
  title: string;
  description: string;
  matchScore: number;
  dwas: DetailedWorkActivity[];
  skills: OnetSkill[];
  tools: string[];
  technologies: string[];
  tasks: string[];
}

export interface DetailedWorkActivity {
  id: string;
  name: string;
  description: string;
  importance: number;
  level: number;
}

export interface OnetSkill {
  id: string;
  name: string;
  description: string;
  importance: number;
  level: number;
}

export interface OnetMappingResult {
  occupations: OnetOccupation[];
  totalMapped: number;
  unmappedSkills: string[];
  cacheHits: number;
  apiCalls: number;
}

const ONET_API_BASE = 'https://services.onetcenter.org/ws';
const ONET_VERSION = 'online';

// In-memory cache (30-day TTL)
const onetCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Main: Map extracted skills to O*NET occupations with full details
 */
export async function mapSkillsToOnet(
  skillKeywords: string[]
): Promise<OnetMappingResult> {
  console.log(`\n🔍 [O*NET] Mapping ${skillKeywords.length} skills to occupations...`);

  const occupations: OnetOccupation[] = [];
  const unmappedSkills: string[] = [];
  let cacheHits = 0;
  let apiCalls = 0;

  // Check if credentials are available
  const username = Deno.env.get('ONET_USERNAME');
  const password = Deno.env.get('ONET_PASSWORD');

  if (!username || !password) {
    console.warn('⚠️ O*NET credentials not configured — returning empty mapping');
    return { occupations: [], totalMapped: 0, unmappedSkills: skillKeywords, cacheHits: 0, apiCalls: 0 };
  }

  // Step 1: Search occupations by skill keywords
  const searchQuery = skillKeywords.slice(0, 3).join(' ');
  const cacheKey = `search:${searchQuery}`;
  const cached = getFromCache(cacheKey);

  let searchOccupations: OnetOccupation[];
  if (cached) {
    searchOccupations = cached;
    cacheHits++;
  } else {
    const url = `${ONET_API_BASE}/${ONET_VERSION}/search?keyword=${encodeURIComponent(searchQuery)}`;
    const response = await callOnetAPI(url, username, password);
    apiCalls++;

    searchOccupations = [];
    if (response?.occupation) {
      for (const occ of response.occupation.slice(0, 10)) {
        const matchScore = calculateMatchScore(skillKeywords, occ.title, occ.tags || []);
        searchOccupations.push({
          code: occ.code,
          title: occ.title,
          description: occ.description || '',
          matchScore,
          dwas: [], skills: [], tools: [], technologies: [], tasks: [],
        });
      }
      searchOccupations.sort((a, b) => b.matchScore - a.matchScore);
    }
    setInCache(cacheKey, searchOccupations);
  }

  console.log(`  Found ${searchOccupations.length} potential occupations`);

  // Step 2: Get detailed data for top 5
  const topOccupations = searchOccupations.slice(0, 5);

  for (const occ of topOccupations) {
    console.log(`  📊 Fetching details for: ${occ.title} (${occ.code})`);
    const details = await getOccupationDetails(occ.code, username, password);
    apiCalls += details.apiCalls;
    cacheHits += details.cacheHits;

    occupations.push({
      ...occ,
      dwas: details.dwas,
      skills: details.skills,
      tools: details.tools,
      technologies: details.technologies,
      tasks: details.tasks,
    });
  }

  // Step 3: Identify unmapped skills
  const mappedSkillNames = new Set(
    occupations.flatMap(occ => occ.skills.map(s => s.name.toLowerCase()))
  );
  for (const skill of skillKeywords) {
    if (!mappedSkillNames.has(skill.toLowerCase())) {
      unmappedSkills.push(skill);
    }
  }

  console.log(`  ✅ Mapped to ${occupations.length} occupations`);
  console.log(`  ⚠️ Unmapped skills: ${unmappedSkills.length}`);
  console.log(`  💾 Cache hits: ${cacheHits}, API calls: ${apiCalls}`);

  return { occupations, totalMapped: occupations.length, unmappedSkills, cacheHits, apiCalls };
}

// ============================================
// DETAIL FETCHERS (parallel)
// ============================================

async function getOccupationDetails(
  socCode: string, username: string, password: string
): Promise<{
  dwas: DetailedWorkActivity[]; skills: OnetSkill[];
  tools: string[]; technologies: string[]; tasks: string[];
  apiCalls: number; cacheHits: number;
}> {
  const [dwasData, skillsData, toolsData, techData, tasksData] = await Promise.all([
    fetchDWAs(socCode, username, password),
    fetchSkills(socCode, username, password),
    fetchTools(socCode, username, password),
    fetchTechnologies(socCode, username, password),
    fetchTasks(socCode, username, password),
  ]);

  return {
    dwas: dwasData.data,
    skills: skillsData.data,
    tools: toolsData.data,
    technologies: techData.data,
    tasks: tasksData.data,
    apiCalls: [dwasData, skillsData, toolsData, techData, tasksData].reduce((s, d) => s + d.apiCalls, 0),
    cacheHits: [dwasData, skillsData, toolsData, techData, tasksData].reduce((s, d) => s + d.cacheHits, 0),
  };
}

async function fetchDWAs(socCode: string, u: string, p: string) {
  return cachedFetch(`dwas:${socCode}`, `${ONET_API_BASE}/${ONET_VERSION}/occupations/${socCode}/details/work_activities`, u, p,
    (r: any) => (r?.work_activity || []).map((wa: any) => ({
      id: wa.id, name: wa.name, description: wa.description || wa.name,
      importance: parseFloat(wa.importance?.value || '0'), level: parseFloat(wa.level?.value || '0'),
    }))
  );
}

async function fetchSkills(socCode: string, u: string, p: string) {
  return cachedFetch(`skills:${socCode}`, `${ONET_API_BASE}/${ONET_VERSION}/occupations/${socCode}/details/skills`, u, p,
    (r: any) => (r?.skill || []).map((s: any) => ({
      id: s.id, name: s.name, description: s.description || s.name,
      importance: parseFloat(s.importance?.value || '0'), level: parseFloat(s.level?.value || '0'),
    }))
  );
}

async function fetchTools(socCode: string, u: string, p: string) {
  return cachedFetch(`tools:${socCode}`, `${ONET_API_BASE}/${ONET_VERSION}/occupations/${socCode}/details/tools_used`, u, p,
    (r: any) => (r?.tool || []).map((t: any) => t.name)
  );
}

async function fetchTechnologies(socCode: string, u: string, p: string) {
  return cachedFetch(`tech:${socCode}`, `${ONET_API_BASE}/${ONET_VERSION}/occupations/${socCode}/details/technology_skills`, u, p,
    (r: any) => (r?.technology || []).map((t: any) => t.name)
  );
}

async function fetchTasks(socCode: string, u: string, p: string) {
  return cachedFetch(`tasks:${socCode}`, `${ONET_API_BASE}/${ONET_VERSION}/occupations/${socCode}/details/tasks`, u, p,
    (r: any) => (r?.task || []).map((t: any) => t.statement || t.name)
  );
}

// ============================================
// GENERIC CACHED FETCH
// ============================================

async function cachedFetch<T>(
  cacheKey: string, url: string, username: string, password: string,
  parser: (data: any) => T
): Promise<{ data: T; apiCalls: number; cacheHits: number }> {
  const cached = getFromCache(cacheKey);
  if (cached) return { data: cached as T, apiCalls: 0, cacheHits: 1 };

  const response = await callOnetAPI(url, username, password);
  const data = parser(response);
  setInCache(cacheKey, data);
  return { data, apiCalls: 1, cacheHits: 0 };
}

// ============================================
// API CALL
// ============================================

async function callOnetAPI(url: string, username: string, password: string): Promise<any> {
  const authString = btoa(`${username}:${password}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json',
        'User-Agent': 'SyllabusStack/1.0',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      if (response.status === 429) {
        console.warn(`  ⏳ O*NET rate limit exceeded`);
        return null;
      }
      console.warn(`  ⚠️ O*NET API error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`  ❌ O*NET API call failed:`, error);
    return null;
  }
}

// ============================================
// HELPERS
// ============================================

function calculateMatchScore(skillKeywords: string[], title: string, tags: string[]): number {
  const safeTags = Array.isArray(tags) ? tags : [];
  const allTerms = [title, ...safeTags].join(' ').toLowerCase();
  let matches = 0;
  for (const keyword of skillKeywords) {
    if (allTerms.includes(keyword.toLowerCase())) matches++;
  }
  return skillKeywords.length > 0 ? matches / skillKeywords.length : 0;
}

function getFromCache(key: string): any | null {
  const cached = onetCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    onetCache.delete(key);
    return null;
  }
  return cached.data;
}

function setInCache(key: string, data: any): void {
  onetCache.set(key, { data, timestamp: Date.now() });
}
