/**
 * Skill Extractor Module
 *
 * Extracts discrete skills from learning objectives for the verified_skills system.
 * Maps Bloom's taxonomy levels to proficiency levels and categorizes skills by domain.
 */

export interface ExtractedSkill {
  skill_name: string;
  skill_category: string;
  proficiency_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  confidence: number; // 0-1 confidence in extraction
}

export interface LearningObjectiveData {
  id: string;
  text: string;
  core_concept?: string | null;
  action_verb?: string | null;
  bloom_level?: string | null;
  domain?: string | null;
  specificity?: string | null;
  search_keywords?: string[] | null;
}

/**
 * Maps Bloom's taxonomy levels to proficiency levels
 * Lower levels = learning basics, higher levels = demonstrating mastery
 */
const BLOOM_TO_PROFICIENCY: Record<string, ExtractedSkill['proficiency_level']> = {
  'remember': 'beginner',
  'understand': 'beginner',
  'apply': 'intermediate',
  'analyze': 'intermediate',
  'evaluate': 'advanced',
  'create': 'expert',
};

/**
 * Maps specificity levels to proficiency adjustments
 */
const SPECIFICITY_ADJUSTMENT: Record<string, number> = {
  'introductory': -1, // lower the proficiency
  'intermediate': 0,  // keep as-is
  'advanced': 1,      // raise the proficiency
};

/**
 * Proficiency level order for adjustments
 */
const PROFICIENCY_ORDER: ExtractedSkill['proficiency_level'][] = [
  'beginner', 'intermediate', 'advanced', 'expert'
];

/**
 * Maps domain to skill category
 */
const DOMAIN_TO_CATEGORY: Record<string, string> = {
  'business': 'Business & Management',
  'science': 'Science & Research',
  'humanities': 'Humanities & Social Sciences',
  'technical': 'Technical & Engineering',
  'arts': 'Creative & Design',
  'other': 'General Skills',
};

/**
 * Common action verbs that indicate specific skill types
 */
const VERB_SKILL_MAPPING: Record<string, string> = {
  // Analysis skills
  'analyze': 'Analysis',
  'evaluate': 'Critical Evaluation',
  'compare': 'Comparative Analysis',
  'contrast': 'Comparative Analysis',
  'differentiate': 'Critical Analysis',
  'examine': 'Research & Examination',

  // Communication skills
  'explain': 'Communication',
  'describe': 'Technical Writing',
  'present': 'Presentation',
  'discuss': 'Discussion & Debate',
  'articulate': 'Communication',

  // Application skills
  'apply': 'Practical Application',
  'implement': 'Implementation',
  'use': 'Tool Proficiency',
  'demonstrate': 'Practical Demonstration',
  'execute': 'Execution',

  // Creation skills
  'create': 'Creative Development',
  'design': 'Design',
  'develop': 'Development',
  'construct': 'Construction',
  'compose': 'Composition',
  'build': 'Building & Construction',

  // Problem-solving skills
  'solve': 'Problem Solving',
  'troubleshoot': 'Troubleshooting',
  'debug': 'Debugging',
  'optimize': 'Optimization',

  // Research skills
  'research': 'Research',
  'investigate': 'Investigation',
  'explore': 'Exploration',
  'discover': 'Discovery',
};

/**
 * Extracts skills from a learning objective
 *
 * @param lo - Learning objective data
 * @returns Array of extracted skills
 */
export function extractSkillsFromLearningObjective(lo: LearningObjectiveData): ExtractedSkill[] {
  const skills: ExtractedSkill[] = [];

  // Primary skill from core_concept
  if (lo.core_concept) {
    const primarySkill = createPrimarySkill(lo);
    if (primarySkill) {
      skills.push(primarySkill);
    }
  }

  // Secondary skill from action verb (process skill)
  if (lo.action_verb) {
    const processSkill = createProcessSkill(lo);
    if (processSkill) {
      skills.push(processSkill);
    }
  }

  // If no core_concept, extract from full text
  if (!lo.core_concept && lo.text) {
    const textSkills = extractSkillsFromText(lo.text, lo);
    skills.push(...textSkills);
  }

  // Deduplicate skills by name
  const uniqueSkills = deduplicateSkills(skills);

  return uniqueSkills;
}

/**
 * Creates the primary skill from the core concept
 */
function createPrimarySkill(lo: LearningObjectiveData): ExtractedSkill | null {
  if (!lo.core_concept) return null;

  // Clean and format the skill name
  const skillName = formatSkillName(lo.core_concept);
  if (!skillName) return null;

  // Determine proficiency level
  const proficiency = calculateProficiency(lo.bloom_level, lo.specificity);

  // Determine category
  const category = DOMAIN_TO_CATEGORY[lo.domain || 'other'] || 'General Skills';

  return {
    skill_name: skillName,
    skill_category: category,
    proficiency_level: proficiency,
    confidence: 0.9, // High confidence when core_concept is explicitly provided
  };
}

/**
 * Creates a process/methodology skill from the action verb
 */
function createProcessSkill(lo: LearningObjectiveData): ExtractedSkill | null {
  if (!lo.action_verb) return null;

  const verb = lo.action_verb.toLowerCase();
  const processType = VERB_SKILL_MAPPING[verb];

  if (!processType) return null;

  // Combine with domain for a more specific skill
  const domain = lo.domain || 'general';
  const domainLabel = DOMAIN_TO_CATEGORY[domain] || 'General';

  // Only create if it adds value (not too generic)
  if (['Practical Application', 'Communication'].includes(processType)) {
    return null; // Too generic
  }

  return {
    skill_name: processType,
    skill_category: domainLabel,
    proficiency_level: calculateProficiency(lo.bloom_level, lo.specificity),
    confidence: 0.7, // Lower confidence for verb-derived skills
  };
}

/**
 * Extracts skills from the full text when no core_concept is available
 */
function extractSkillsFromText(text: string, lo: LearningObjectiveData): ExtractedSkill[] {
  const skills: ExtractedSkill[] = [];

  // Simple keyword extraction
  // Remove common stopwords and extract noun phrases
  const stopwords = new Set([
    'the', 'a', 'an', 'to', 'for', 'of', 'and', 'or', 'in', 'on', 'at', 'by',
    'with', 'from', 'as', 'is', 'are', 'be', 'been', 'being', 'have', 'has',
    'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
    'might', 'must', 'shall', 'can', 'need', 'that', 'this', 'these', 'those',
    'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your', 'i', 'my',
    'how', 'what', 'when', 'where', 'why', 'which', 'who', 'whom', 'whose',
    'able', 'about', 'after', 'all', 'also', 'any', 'because', 'before',
    'between', 'both', 'but', 'each', 'either', 'even', 'every', 'first',
    'into', 'just', 'last', 'least', 'less', 'many', 'more', 'most', 'much',
    'neither', 'no', 'nor', 'not', 'now', 'only', 'other', 'out', 'over',
    'same', 'so', 'some', 'still', 'such', 'than', 'then', 'there', 'through',
    'too', 'under', 'up', 'upon', 'very', 'well', 'while', 'within', 'without',
    'student', 'students', 'learner', 'learners', 'able', 'ability'
  ]);

  // Extract potential skill keywords
  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopwords.has(word));

  // Look for noun-noun or adjective-noun combinations
  const keywords = lo.search_keywords || [];

  // Combine with extracted words, prioritize search_keywords
  const allKeywords = [...new Set([...keywords, ...words.slice(0, 3)])];

  // Create skill from most relevant keyword
  if (allKeywords.length > 0) {
    const skillName = formatSkillName(allKeywords[0]);
    if (skillName) {
      skills.push({
        skill_name: skillName,
        skill_category: DOMAIN_TO_CATEGORY[lo.domain || 'other'] || 'General Skills',
        proficiency_level: calculateProficiency(lo.bloom_level, lo.specificity),
        confidence: 0.5, // Lower confidence for text extraction
      });
    }
  }

  return skills;
}

/**
 * Calculates proficiency level based on Bloom's level and specificity
 */
function calculateProficiency(
  bloomLevel?: string | null,
  specificity?: string | null
): ExtractedSkill['proficiency_level'] {
  // Start with Bloom's level
  let baseProficiency = BLOOM_TO_PROFICIENCY[bloomLevel?.toLowerCase() || 'apply'] || 'intermediate';

  // Apply specificity adjustment
  if (specificity) {
    const adjustment = SPECIFICITY_ADJUSTMENT[specificity.toLowerCase()] || 0;
    const currentIndex = PROFICIENCY_ORDER.indexOf(baseProficiency);
    const newIndex = Math.max(0, Math.min(PROFICIENCY_ORDER.length - 1, currentIndex + adjustment));
    baseProficiency = PROFICIENCY_ORDER[newIndex];
  }

  return baseProficiency;
}

/**
 * Formats a skill name for consistency
 */
function formatSkillName(raw: string): string | null {
  if (!raw) return null;

  // Clean up the string
  let name = raw
    .trim()
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/[^\w\s-]/g, ''); // Remove special chars except hyphen

  // Skip if too short or too long
  if (name.length < 2 || name.length > 100) return null;

  // Title case
  name = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return name;
}

/**
 * Removes duplicate skills, keeping the one with highest confidence
 */
function deduplicateSkills(skills: ExtractedSkill[]): ExtractedSkill[] {
  const skillMap = new Map<string, ExtractedSkill>();

  for (const skill of skills) {
    const key = skill.skill_name.toLowerCase();
    const existing = skillMap.get(key);

    if (!existing || skill.confidence > existing.confidence) {
      skillMap.set(key, skill);
    }
  }

  return Array.from(skillMap.values());
}

/**
 * Batch extracts skills from multiple learning objectives
 * Useful for extracting skills from an entire course
 */
export function extractSkillsFromObjectives(
  objectives: LearningObjectiveData[]
): ExtractedSkill[] {
  const allSkills: ExtractedSkill[] = [];

  for (const lo of objectives) {
    const skills = extractSkillsFromLearningObjective(lo);
    allSkills.push(...skills);
  }

  // Deduplicate across all objectives, upgrading proficiency where skills repeat
  return consolidateSkills(allSkills);
}

/**
 * Consolidates skills from multiple sources, upgrading proficiency for repeated skills
 */
function consolidateSkills(skills: ExtractedSkill[]): ExtractedSkill[] {
  const skillMap = new Map<string, { skill: ExtractedSkill; count: number }>();

  for (const skill of skills) {
    const key = skill.skill_name.toLowerCase();
    const existing = skillMap.get(key);

    if (!existing) {
      skillMap.set(key, { skill, count: 1 });
    } else {
      existing.count++;
      // Upgrade proficiency if skill appears multiple times (indicates depth)
      if (existing.count >= 3) {
        const currentIndex = PROFICIENCY_ORDER.indexOf(existing.skill.proficiency_level);
        if (currentIndex < PROFICIENCY_ORDER.length - 1) {
          existing.skill.proficiency_level = PROFICIENCY_ORDER[currentIndex + 1];
        }
      }
      // Keep higher confidence
      if (skill.confidence > existing.skill.confidence) {
        existing.skill.confidence = skill.confidence;
      }
    }
  }

  return Array.from(skillMap.values()).map(({ skill }) => skill);
}
