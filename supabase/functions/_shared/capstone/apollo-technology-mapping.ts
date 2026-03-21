/**
 * Apollo Technology UID Mapping
 * Ported from EduThree1's onet-structured-service.ts technology mapping section
 *
 * Maps SOC codes and skill names to Apollo's `currently_using_any_of_technology_uids`.
 * Strategy 1 (technology filter) is the most precise Apollo search method.
 *
 * NOTE: EduThree1 discovered that Apollo's technology UID filtering was unreliable
 * and disabled it in production. These UIDs are best-effort placeholders.
 * The mapping is still useful for:
 * - Enrichment: matching company technologies against course requirements
 * - Scoring: boosting companies that use relevant technologies
 * - Future: if Apollo fixes their technology filter endpoint
 */

export interface TechnologyMapping {
  name: string;
  apolloUid: string;
  category: string;
}

/**
 * Maps technology/tool names to Apollo technology UIDs
 * These are used for Apollo's `currently_using_any_of_technology_uids` filter
 */
const TECHNOLOGY_TO_APOLLO_UID: Record<string, TechnologyMapping> = {
  // CAD Software
  'solidworks': { name: 'SolidWorks', apolloUid: '5c1042a6c9e77c0001dda6f4', category: 'cad' },
  'autocad': { name: 'AutoCAD', apolloUid: '5c1042a6c9e77c0001dda6f5', category: 'cad' },
  'catia': { name: 'CATIA', apolloUid: '5c1042a6c9e77c0001dda6f6', category: 'cad' },
  'inventor': { name: 'Inventor', apolloUid: '5c1042a6c9e77c0001dda6f7', category: 'cad' },
  'creo': { name: 'Creo', apolloUid: '5c1042a6c9e77c0001dda6f8', category: 'cad' },

  // Simulation & Analysis
  'ansys': { name: 'ANSYS', apolloUid: '5c1042a6c9e77c0001dda700', category: 'simulation' },
  'matlab': { name: 'MATLAB', apolloUid: '5c1042a6c9e77c0001dda701', category: 'simulation' },
  'simulink': { name: 'Simulink', apolloUid: '5c1042a6c9e77c0001dda702', category: 'simulation' },
  'abaqus': { name: 'Abaqus', apolloUid: '5c1042a6c9e77c0001dda703', category: 'simulation' },
  'comsol': { name: 'COMSOL', apolloUid: '5c1042a6c9e77c0001dda704', category: 'simulation' },

  // Programming Languages
  'python': { name: 'Python', apolloUid: '5c1042a6c9e77c0001dda710', category: 'programming' },
  'java': { name: 'Java', apolloUid: '5c1042a6c9e77c0001dda711', category: 'programming' },
  'javascript': { name: 'JavaScript', apolloUid: '5c1042a6c9e77c0001dda712', category: 'programming' },
  'c++': { name: 'C++', apolloUid: '5c1042a6c9e77c0001dda713', category: 'programming' },
  'sql': { name: 'SQL', apolloUid: '5c1042a6c9e77c0001dda714', category: 'programming' },
  'r': { name: 'R', apolloUid: '5c1042a6c9e77c0001dda723', category: 'programming' },
  'typescript': { name: 'TypeScript', apolloUid: '5c1042a6c9e77c0001dda715', category: 'programming' },

  // Data & Analytics
  'tableau': { name: 'Tableau', apolloUid: '5c1042a6c9e77c0001dda720', category: 'analytics' },
  'power bi': { name: 'Power BI', apolloUid: '5c1042a6c9e77c0001dda721', category: 'analytics' },
  'excel': { name: 'Excel', apolloUid: '5c1042a6c9e77c0001dda722', category: 'analytics' },
  'spss': { name: 'SPSS', apolloUid: '5c1042a6c9e77c0001dda724', category: 'analytics' },
  'sas': { name: 'SAS', apolloUid: '5c1042a6c9e77c0001dda725', category: 'analytics' },

  // Cloud & DevOps
  'aws': { name: 'AWS', apolloUid: '5c1042a6c9e77c0001dda730', category: 'cloud' },
  'azure': { name: 'Azure', apolloUid: '5c1042a6c9e77c0001dda731', category: 'cloud' },
  'gcp': { name: 'Google Cloud', apolloUid: '5c1042a6c9e77c0001dda734', category: 'cloud' },
  'docker': { name: 'Docker', apolloUid: '5c1042a6c9e77c0001dda732', category: 'cloud' },
  'kubernetes': { name: 'Kubernetes', apolloUid: '5c1042a6c9e77c0001dda733', category: 'cloud' },

  // ERP & Business
  'sap': { name: 'SAP', apolloUid: '5c1042a6c9e77c0001dda740', category: 'erp' },
  'oracle': { name: 'Oracle', apolloUid: '5c1042a6c9e77c0001dda741', category: 'erp' },
  'salesforce': { name: 'Salesforce', apolloUid: '5c1042a6c9e77c0001dda742', category: 'crm' },
  'hubspot': { name: 'HubSpot', apolloUid: '5c1042a6c9e77c0001dda743', category: 'crm' },

  // Design
  'figma': { name: 'Figma', apolloUid: '5c1042a6c9e77c0001dda750', category: 'design' },
  'adobe creative suite': { name: 'Adobe Creative Suite', apolloUid: '5c1042a6c9e77c0001dda751', category: 'design' },

  // ML/AI
  'tensorflow': { name: 'TensorFlow', apolloUid: '5c1042a6c9e77c0001dda760', category: 'ml' },
  'pytorch': { name: 'PyTorch', apolloUid: '5c1042a6c9e77c0001dda761', category: 'ml' },

  // Manufacturing
  'plc': { name: 'PLC Programming', apolloUid: '5c1042a6c9e77c0001dda770', category: 'manufacturing' },
  'arena': { name: 'Arena Simulation', apolloUid: '5c1042a6c9e77c0001dda771', category: 'manufacturing' },
  'minitab': { name: 'Minitab', apolloUid: '5c1042a6c9e77c0001dda772', category: 'manufacturing' },
  'six sigma': { name: 'Six Sigma', apolloUid: '5c1042a6c9e77c0001dda773', category: 'manufacturing' },
};

/**
 * SOC code → relevant technology categories mapping
 */
const SOC_TECHNOLOGY_MAP: Record<string, string[]> = {
  // Mechanical Engineering
  '17-2141.00': ['solidworks', 'autocad', 'ansys', 'matlab', 'catia', 'creo', 'inventor', 'abaqus', 'comsol'],
  // Systems Engineering
  '17-2199.00': ['matlab', 'simulink', 'python', 'arena', 'minitab', 'plc', 'six sigma'],
  // Computer/Software Engineering
  '15-1252.00': ['python', 'java', 'javascript', 'typescript', 'sql', 'aws', 'docker', 'kubernetes'],
  '15-1256.00': ['python', 'java', 'javascript', 'typescript', 'sql', 'aws', 'docker'],
  // Electrical Engineering
  '17-2071.00': ['matlab', 'simulink', 'autocad', 'plc', 'python'],
  // Civil Engineering
  '17-2051.00': ['autocad', 'matlab', 'excel', 'python'],
  // Chemical Engineering
  '17-2041.00': ['matlab', 'comsol', 'python', 'excel', 'minitab'],
  // Data Science / Statistics
  '15-2051.00': ['python', 'r', 'sql', 'tableau', 'power bi', 'tensorflow', 'pytorch', 'sas', 'spss'],
  // Management Analysts
  '13-1111.00': ['excel', 'power bi', 'tableau', 'sap', 'salesforce'],
  // Financial Analysts
  '13-2051.00': ['excel', 'python', 'sql', 'power bi', 'tableau', 'sap', 'oracle'],
  // Accountants
  '13-2011.00': ['excel', 'sap', 'oracle', 'power bi', 'sql'],
  // Marketing Managers
  '11-2021.00': ['salesforce', 'hubspot', 'tableau', 'excel', 'python'],
  // IT Managers
  '11-3021.00': ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'python', 'sql'],
  // Operations Managers
  '11-1021.00': ['sap', 'oracle', 'excel', 'power bi', 'six sigma', 'minitab'],
  // Industrial Engineers
  '17-2112.00': ['minitab', 'arena', 'plc', 'six sigma', 'excel', 'python', 'matlab'],
};

/**
 * Get Apollo technology UIDs for a set of SOC codes
 */
export function getTechnologyUIDsFromSOC(socCodes: string[]): string[] {
  const uids = new Set<string>();

  for (const soc of socCodes) {
    const techNames = SOC_TECHNOLOGY_MAP[soc] || [];
    for (const techName of techNames) {
      const mapping = TECHNOLOGY_TO_APOLLO_UID[techName];
      if (mapping) {
        uids.add(mapping.apolloUid);
      }
    }
  }

  return [...uids];
}

/**
 * Get technology names for a set of SOC codes (for display/matching, not Apollo filter)
 */
export function getTechnologyNamesFromSOC(socCodes: string[]): string[] {
  const names = new Set<string>();

  for (const soc of socCodes) {
    const techNames = SOC_TECHNOLOGY_MAP[soc] || [];
    for (const techName of techNames) {
      const mapping = TECHNOLOGY_TO_APOLLO_UID[techName];
      if (mapping) {
        names.add(mapping.name);
      }
    }
  }

  return [...names];
}

/**
 * Match company technologies against course-relevant technologies
 * Returns a score (0-1) based on technology overlap
 */
export function scoreTechnologyMatch(
  companyTechnologies: string[],
  courseSocCodes: string[]
): { score: number; matchingTechs: string[]; courseTechs: string[] } {
  const courseTechNames = getTechnologyNamesFromSOC(courseSocCodes);
  if (courseTechNames.length === 0 || companyTechnologies.length === 0) {
    return { score: 0.5, matchingTechs: [], courseTechs: courseTechNames };
  }

  const companyLower = companyTechnologies.map(t => t.toLowerCase());
  const matchingTechs: string[] = [];

  for (const courseTech of courseTechNames) {
    if (companyLower.some(ct =>
      ct.includes(courseTech.toLowerCase()) ||
      courseTech.toLowerCase().includes(ct)
    )) {
      matchingTechs.push(courseTech);
    }
  }

  const score = matchingTechs.length / courseTechNames.length;
  return { score: Math.min(1.0, score), matchingTechs, courseTechs: courseTechNames };
}

/**
 * Extract technology names from skill keywords (for when SOC mapping isn't available)
 */
export function extractTechnologyFromSkills(skills: string[]): TechnologyMapping[] {
  const found: TechnologyMapping[] = [];
  const seen = new Set<string>();

  for (const skill of skills) {
    const lower = skill.toLowerCase();
    for (const [key, mapping] of Object.entries(TECHNOLOGY_TO_APOLLO_UID)) {
      if ((lower.includes(key) || key.includes(lower)) && !seen.has(key)) {
        seen.add(key);
        found.push(mapping);
      }
    }
  }

  return found;
}
