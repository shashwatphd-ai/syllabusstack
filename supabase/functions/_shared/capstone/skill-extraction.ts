/**
 * Skill Extraction for Capstone Pipeline
 * Extracts structured skills from course learning objectives
 * Simplified from EduThree1's 744-line service to pattern-based extraction
 */

export interface ExtractedSkill {
  skill: string;
  category: 'technical' | 'analytical' | 'domain' | 'tool' | 'framework';
  confidence: number;
  keywords: string[];
}

/**
 * Extract skills from learning objective texts
 */
export function extractSkillsFromObjectives(
  objectiveTexts: string[],
  courseTitle?: string
): ExtractedSkill[] {
  const skills: ExtractedSkill[] = [];
  const seen = new Set<string>();

  for (const text of objectiveTexts) {
    // Extract tools/software
    const toolPattern = /\b(MATLAB|Python|Java|JavaScript|SQL|Excel|Tableau|PowerBI|AutoCAD|SolidWorks|ANSYS|COMSOL|SPSS|R|TensorFlow|PyTorch|AWS|Azure|GCP|Docker|Kubernetes|Git|React|SAP|Oracle|Salesforce)\b/gi;
    for (const match of text.matchAll(toolPattern)) {
      const tool = match[1];
      if (!seen.has(tool.toLowerCase())) {
        seen.add(tool.toLowerCase());
        skills.push({ skill: tool, category: 'tool', confidence: 0.95, keywords: [tool.toLowerCase()] });
      }
    }

    // Extract technical terms (capitalized multi-word phrases)
    const techPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
    for (const match of text.matchAll(techPattern)) {
      const term = match[1];
      if (!seen.has(term.toLowerCase()) && isTechnical(term)) {
        seen.add(term.toLowerCase());
        skills.push({ skill: term, category: 'technical', confidence: 0.75, keywords: term.toLowerCase().split(' ') });
      }
    }

    // Extract action-based skills (e.g., "Apply Bernoulli's equation")
    const actionPattern = /(?:apply|use|implement|develop|design|analyze|calculate|model|simulate|optimize)\s+([A-Z][a-z]+(?:'s)?\s+(?:equation|theorem|principle|law|method|algorithm|model|analysis|framework|technique))/gi;
    for (const match of text.matchAll(actionPattern)) {
      const skill = match[1].trim();
      if (!seen.has(skill.toLowerCase()) && skill.length > 3) {
        seen.add(skill.toLowerCase());
        skills.push({ skill, category: 'domain', confidence: 0.85, keywords: skill.toLowerCase().split(' ') });
      }
    }
  }

  // Infer from course title if few skills found
  if (skills.length < 3 && courseTitle) {
    const inferred = inferFromTitle(courseTitle);
    for (const s of inferred) {
      if (!seen.has(s.skill.toLowerCase())) {
        seen.add(s.skill.toLowerCase());
        skills.push(s);
      }
    }
  }

  return skills.sort((a, b) => b.confidence - a.confidence);
}

function isTechnical(term: string): boolean {
  const nonTechnical = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'will', 'have', 'been', 'each', 'other']);
  const words = term.toLowerCase().split(' ');
  return words.every(w => !nonTechnical.has(w)) && words.length <= 4;
}

const COURSE_SKILL_MAP: Record<string, { skills: string[]; category: ExtractedSkill['category'] }> = {
  'mechanical engineering': { skills: ['Mechanical Design', 'CAD Design', 'Thermodynamics', 'FEA', 'Materials Science'], category: 'technical' },
  'computer science': { skills: ['Programming', 'Data Structures', 'Algorithms', 'Software Development', 'Database Management'], category: 'technical' },
  'data science': { skills: ['Data Analysis', 'Statistical Modeling', 'Machine Learning', 'Data Visualization', 'Python'], category: 'analytical' },
  'business': { skills: ['Market Research', 'Financial Analysis', 'Strategic Planning', 'Business Intelligence', 'Project Management'], category: 'analytical' },
  'marketing': { skills: ['Digital Marketing', 'Customer Segmentation', 'Content Strategy', 'SEO', 'Marketing Analytics'], category: 'analytical' },
  'finance': { skills: ['Financial Modeling', 'Valuation', 'Risk Assessment', 'Portfolio Management', 'Corporate Finance'], category: 'analytical' },
};

function inferFromTitle(title: string): ExtractedSkill[] {
  const lower = title.toLowerCase();
  for (const [key, mapping] of Object.entries(COURSE_SKILL_MAP)) {
    if (lower.includes(key)) {
      return mapping.skills.map(skill => ({
        skill,
        category: mapping.category,
        confidence: 0.65,
        keywords: skill.toLowerCase().split(' '),
      }));
    }
  }
  return [];
}
