/**
 * ALIGNMENT SERVICE
 * Ported from EduThree1's alignment-service.ts (348 lines)
 * 
 * Calculates how well projects align with:
 * 1. Course learning objectives (LO alignment) — AI-powered
 * 2. Market demands (Market alignment score) — keyword + synonym matching
 * 3. Detailed LO-to-task mapping — structured coverage data
 * 
 * Uses SyllabusStack's unified-ai-client.ts
 */

import { generateText, MODELS } from '../unified-ai-client.ts';

/**
 * Calculate Learning Objectives Alignment Score using AI
 * Returns 0-1 score representing coverage percentage
 */
export async function calculateLOAlignment(
  tasks: string[],
  deliverables: string[],
  objectives: string[],
  loAlignment: string
): Promise<number> {
  try {
    const prompt = `Analyze how well this project aligns with the course learning objectives.

Course Learning Objectives:
${objectives.map((o, i) => `LO${i + 1}: ${o}`).join('\n')}

Project Tasks:
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Project Deliverables:
${deliverables.map((d, i) => `${i + 1}. ${d}`).join('\n')}

AI Project Designer's Alignment Explanation:
${loAlignment}

For each learning objective, determine if the project adequately addresses it through its tasks and deliverables.

Return ONLY a JSON object with:
{
  "coverage_percentage": <0-100 number>,
  "outcomes_covered": ["LO1", "LO3", ...],
  "gaps": ["Brief explanation of any gaps"]
}`;

    const result = await generateText({
      prompt,
      systemPrompt: 'You are a learning outcomes assessment expert. Return only valid JSON.',
      model: MODELS.FAST, temperature: 0.3,
    });

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return 0.7;

    const parsed = JSON.parse(jsonMatch[0]);
    const coverage = parsed.coverage_percentage;
    if (typeof coverage !== 'number' || isNaN(coverage) || coverage < 0 || coverage > 100) return 0.7;

    return coverage / 100;
  } catch (error) {
    console.error('calculateLOAlignment failed:', error);
    return 0.7; // Fallback
  }
}

/**
 * Generate Detailed LO Alignment Mapping
 * Returns structured data showing which tasks/deliverables map to which LOs
 */
export async function generateLOAlignmentDetail(
  tasks: string[],
  deliverables: string[],
  objectives: string[],
  proposalLOSummary: string
): Promise<any | null> {
  try {
    const prompt = `Analyze how project activities align with course learning objectives.

LEARNING OBJECTIVES:
${objectives.map((o, i) => `${i}: ${o}`).join('\n')}

PROJECT TASKS (total: ${tasks.length}):
${tasks.map((t, i) => `${i}: ${t}`).join('\n')}

PROJECT DELIVERABLES (total: ${deliverables.length}):
${deliverables.map((d, i) => `${i}: ${d}`).join('\n')}

SUMMARY: ${proposalLOSummary}

Create a detailed mapping. Use ONLY numeric indices for aligned_tasks and aligned_deliverables.

Return ONLY valid JSON:
{
  "outcome_mappings": [
    {
      "outcome_id": "0",
      "outcome_text": "First outcome text",
      "coverage_percentage": 75,
      "aligned_tasks": [0, 2],
      "aligned_deliverables": [1],
      "explanation": "How these tasks/deliverables address this outcome"
    }
  ],
  "task_mappings": [
    {
      "task_id": 0,
      "task_text": "First task",
      "primary_outcome": "0",
      "secondary_outcomes": ["1"]
    }
  ],
  "deliverable_mappings": [
    {
      "deliverable_id": 0,
      "deliverable_text": "First deliverable",
      "primary_outcome": "0",
      "supporting_tasks": [0, 1]
    }
  ]
}`;

    const result = await generateText({
      prompt,
      systemPrompt: 'You are a learning outcomes assessment expert. Return only valid JSON with proper syntax.',
      options: { model: MODELS.FAST, temperature: 0.3, maxTokens: 4000 },
    });

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No valid JSON in LO alignment detail response');
      return null;
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('generateLOAlignmentDetail failed:', error);
    return null;
  }
}

/**
 * Calculate Market Alignment Score
 * 
 * Scores alignment across 3 dimensions with synonym expansion:
 * 1. Job postings alignment (30 points)
 * 2. Technology stack alignment (30 points)
 * 3. Objective keyword alignment (40 points)
 * 
 * Returns: 0-100 score
 */
export function calculateMarketAlignmentScore(
  projectTasks: string[],
  objectives: string[],
  jobPostings: any[],
  technologiesUsed: string[]
): number {
  let score = 0;

  // Build keyword set from objectives with synonym expansion
  const keywords = new Set<string>();
  objectives.forEach(o => {
    o.toLowerCase().split(/[\s,]+/).forEach(w => {
      if (w.length > 4 && !STOP_WORDS.has(w)) keywords.add(w);
    });
  });

  // Synonym expansion for intelligent matching
  const expandedKeywords = new Set(keywords);
  keywords.forEach(keyword => {
    const synonyms = SYNONYM_MAP[keyword];
    if (synonyms) {
      synonyms.forEach(syn => expandedKeywords.add(syn));
    }
  });

  const taskText = projectTasks.join(' ').toLowerCase();

  // Score 1: Job alignment (30 points max)
  if (jobPostings && jobPostings.length > 0) {
    let matched = 0;
    for (const job of jobPostings) {
      const jobText = `${job.title || ''} ${job.description || ''}`.toLowerCase();
      if (Array.from(expandedKeywords).some(kw => jobText.includes(kw))) matched++;
    }
    const jobScore = (matched / jobPostings.length) * 30;
    score += jobScore;
  }

  // Score 2: Tech alignment (30 points max)
  if (technologiesUsed && technologiesUsed.length > 0) {
    const matchedTech = technologiesUsed.filter(tech => {
      const t = (typeof tech === 'string' ? tech : '').toLowerCase();
      return Array.from(expandedKeywords).some(kw => t.includes(kw) || kw.includes(t));
    });
    score += (matchedTech.length / technologiesUsed.length) * 30;
  }

  // Score 3: Objective keyword coverage in tasks (40 points max)
  if (keywords.size > 0) {
    let covered = 0;
    keywords.forEach(kw => {
      if (taskText.includes(kw)) covered++;
    });
    score += (covered / keywords.size) * 40;
  }

  return Math.round(score);
}

// ─── Synonym Map for Market Alignment ───

const SYNONYM_MAP: Record<string, string[]> = {
  'ai': ['artificial', 'intelligence', 'machine', 'learning', 'ml', 'deep', 'neural'],
  'ml': ['machine', 'learning', 'artificial', 'intelligence', 'predictive'],
  'cloud': ['aws', 'azure', 'gcp', 'kubernetes', 'docker', 'serverless'],
  'data': ['analytics', 'database', 'sql', 'nosql', 'etl', 'pipeline'],
  'software': ['development', 'engineering', 'programming', 'coding'],
  'fluid': ['hydraulic', 'flow', 'pressure', 'liquid', 'gas'],
  'mechanical': ['mechanics', 'engineering', 'design', 'cad'],
  'chemical': ['chemistry', 'process', 'reaction', 'synthesis'],
  'simulation': ['modeling', 'cfd', 'fem', 'analysis'],
  'optimization': ['improve', 'enhance', 'efficiency', 'performance'],
  'marketing': ['campaign', 'brand', 'advertising', 'seo', 'digital'],
  'finance': ['financial', 'accounting', 'budgeting', 'valuation', 'investment'],
  'strategy': ['strategic', 'planning', 'competitive', 'market', 'growth'],
  'operations': ['logistics', 'supply', 'chain', 'manufacturing', 'process'],
  'management': ['managerial', 'leadership', 'organizational', 'governance'],
};

const STOP_WORDS = new Set([
  'about', 'using', 'their', 'these', 'which', 'where', 'would', 'could',
  'should', 'there', 'other', 'after', 'before', 'through', 'between',
  'during', 'within', 'apply', 'understand', 'demonstrate', 'explain',
]);
