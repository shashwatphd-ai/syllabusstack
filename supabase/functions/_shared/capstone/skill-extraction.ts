/**
 * Skill Extraction for Capstone Pipeline
 * Enhanced from simple regex to AI-powered translation of academic learning objectives
 * into industry-relevant skills and search parameters.
 *
 * Uses SyllabusStack's unified-ai-client (Gemini Flash) for AI extraction,
 * with SOC-mapping + pattern-based fallback.
 */

import { generateText } from '../unified-ai-client.ts';
import { mapCourseToSOC, generateFallbackSkillsFromSOC } from './course-soc-mapping.ts';
import type { IndustrySkill, SkillExtractionOutput } from './pipeline-types.ts';

export interface ExtractedSkill {
  skill: string;
  category: 'technical' | 'analytical' | 'domain' | 'tool' | 'framework';
  confidence: number;
  keywords: string[];
}

/**
 * AI-powered skill extraction: translates academic learning objectives into
 * industry-relevant skills and Apollo-compatible search keywords.
 */
export async function extractIndustrySkills(
  objectiveTexts: string[],
  courseTitle: string,
  courseLevel: string = '',
  searchKeywords: string[] = []
): Promise<SkillExtractionOutput> {
  const startTime = Date.now();

  // Try AI extraction first
  try {
    const prompt = `You are an industry-academic alignment expert. Given these academic learning objectives for the course "${courseTitle}" (${courseLevel || 'undergraduate'}), extract the industry-relevant skills that employers would recognize.

LEARNING OBJECTIVES:
${objectiveTexts.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Return a JSON array of skills. Each skill should have:
- "skill": the industry-standard skill name (e.g., "Strategic Planning", "Financial Modeling", "Data Visualization")
- "category": one of "technical", "analytical", "domain", "tool", "framework"
- "keywords": 2-4 Apollo-search-compatible industry keywords for this skill

RULES:
- Convert academic language to industry language (e.g., "Apply PESTEL framework" → "Strategic Analysis")
- Include both the specific frameworks AND the broader skill categories
- Include relevant industry sectors where these skills are applied
- Return 8-15 skills
- Output ONLY the JSON array, no markdown`;

    const result = await generateText({
      prompt,
      systemPrompt: 'You are a skill taxonomy expert. Return only valid JSON arrays.',
      options: {
        model: 'google/gemini-2.5-flash',
        temperature: 0.3,
        maxTokens: 2000,
      }
    });

    const content = result.content.trim();
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        skill: string;
        category: string;
        keywords: string[];
      }>;

      const skills: IndustrySkill[] = parsed.map(s => ({
        skill: s.skill,
        category: (s.category || 'technical') as IndustrySkill['category'],
        confidence: 0.85,
        source: 'ai-translation',
        keywords: s.keywords || [s.skill.toLowerCase()]
      }));

      console.log(`✅ AI extracted ${skills.length} industry skills from ${objectiveTexts.length} objectives`);

      return {
        skills,
        extractionMethod: 'ai-translation',
        processingTimeMs: Date.now() - startTime
      };
    }
  } catch (error) {
    console.warn('⚠️ AI skill extraction failed, falling back to SOC mapping:', error);
  }

  // Fallback: SOC mapping + pattern extraction
  return extractSkillsViaSOCFallback(objectiveTexts, courseTitle, courseLevel, startTime);
}

/**
 * Fallback: combine SOC mapping with regex pattern extraction
 */
function extractSkillsViaSOCFallback(
  objectiveTexts: string[],
  courseTitle: string,
  courseLevel: string,
  startTime: number
): SkillExtractionOutput {
  const skills: IndustrySkill[] = [];
  const seen = new Set<string>();

  // Phase 1: SOC-based skills
  const socMappings = mapCourseToSOC(courseTitle, objectiveTexts, courseLevel);
  for (const soc of socMappings) {
    const fallbackSkills = generateFallbackSkillsFromSOC(soc);
    for (const s of fallbackSkills) {
      if (!seen.has(s.skill.toLowerCase())) {
        seen.add(s.skill.toLowerCase());
        skills.push(s);
      }
    }
  }

  // Phase 2: Regex pattern extraction
  const regexSkills = extractSkillsFromObjectives(objectiveTexts, courseTitle);
  for (const s of regexSkills) {
    if (!seen.has(s.skill.toLowerCase())) {
      seen.add(s.skill.toLowerCase());
      skills.push({
        skill: s.skill,
        category: s.category,
        confidence: s.confidence,
        source: 'pattern-fallback',
        keywords: s.keywords
      });
    }
  }

  console.log(`✅ SOC+Pattern fallback extracted ${skills.length} skills`);

  return {
    skills,
    extractionMethod: skills.some(s => s.source?.startsWith('soc')) ? 'soc-fallback' : 'pattern-fallback',
    processingTimeMs: Date.now() - startTime
  };
}

/**
 * Original regex-based skill extraction (kept as inner fallback)
 */
export function extractSkillsFromObjectives(
  objectiveTexts: string[],
  courseTitle?: string
): ExtractedSkill[] {
  const skills: ExtractedSkill[] = [];
  const seen = new Set<string>();

  for (const text of objectiveTexts) {
    // Extract tools/software
    const toolPattern = /\b(MATLAB|Python|Java|JavaScript|SQL|Excel|Tableau|PowerBI|Power\s*BI|AutoCAD|SolidWorks|ANSYS|COMSOL|SPSS|R|TensorFlow|PyTorch|AWS|Azure|GCP|Docker|Kubernetes|Git|React|SAP|Oracle|Salesforce|Bloomberg)\b/gi;
    for (const match of text.matchAll(toolPattern)) {
      const tool = match[1];
      if (!seen.has(tool.toLowerCase())) {
        seen.add(tool.toLowerCase());
        skills.push({ skill: tool, category: 'tool', confidence: 0.95, keywords: [tool.toLowerCase()] });
      }
    }

    // Extract framework/method references
    const frameworkPattern = /(?:apply|use|implement|utilize|leverage)\s+(?:the\s+)?([A-Z][a-z]+(?:'s)?\s+(?:equation|theorem|principle|law|method|algorithm|model|analysis|framework|technique|matrix|scorecard|theory))/gi;
    for (const match of text.matchAll(frameworkPattern)) {
      const skill = match[1].trim();
      if (!seen.has(skill.toLowerCase()) && skill.length > 3) {
        seen.add(skill.toLowerCase());
        skills.push({ skill, category: 'framework', confidence: 0.85, keywords: skill.toLowerCase().split(' ') });
      }
    }

    // Extract capitalized multi-word technical phrases
    const techPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
    for (const match of text.matchAll(techPattern)) {
      const term = match[1];
      if (!seen.has(term.toLowerCase()) && isTechnical(term)) {
        seen.add(term.toLowerCase());
        skills.push({ skill: term, category: 'technical', confidence: 0.75, keywords: term.toLowerCase().split(' ') });
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
  const nonTechnical = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'will', 'have', 'been', 'each', 'other', 'students', 'course']);
  const words = term.toLowerCase().split(' ');
  return words.every(w => !nonTechnical.has(w)) && words.length <= 4;
}

const COURSE_SKILL_MAP: Record<string, { skills: string[]; category: ExtractedSkill['category'] }> = {
  'mechanical engineering': { skills: ['Mechanical Design', 'CAD Design', 'Thermodynamics', 'FEA', 'Materials Science'], category: 'technical' },
  'computer science': { skills: ['Programming', 'Data Structures', 'Algorithms', 'Software Development', 'Database Management'], category: 'technical' },
  'data science': { skills: ['Data Analysis', 'Statistical Modeling', 'Machine Learning', 'Data Visualization', 'Python'], category: 'analytical' },
  'business': { skills: ['Market Research', 'Financial Analysis', 'Strategic Planning', 'Business Intelligence', 'Project Management'], category: 'analytical' },
  'strategic management': { skills: ['Strategic Planning', 'Competitive Analysis', 'Market Analysis', 'Corporate Strategy', 'SWOT Analysis'], category: 'analytical' },
  'operations management': { skills: ['Process Improvement', 'Supply Chain Management', 'Lean Manufacturing', 'Six Sigma', 'Operations Planning'], category: 'analytical' },
  'marketing': { skills: ['Digital Marketing', 'Customer Segmentation', 'Content Strategy', 'SEO', 'Marketing Analytics'], category: 'analytical' },
  'finance': { skills: ['Financial Modeling', 'Valuation', 'Risk Assessment', 'Portfolio Management', 'Corporate Finance'], category: 'analytical' },
  'accounting': { skills: ['Financial Reporting', 'Auditing', 'Tax Preparation', 'GAAP Compliance', 'Cost Accounting'], category: 'analytical' },
  'information systems': { skills: ['Systems Analysis', 'Database Design', 'ERP Systems', 'IT Project Management', 'Business Process Modeling'], category: 'technical' },
  'supply chain': { skills: ['Logistics Planning', 'Procurement', 'Inventory Management', 'Distribution', 'Demand Forecasting'], category: 'analytical' },
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
