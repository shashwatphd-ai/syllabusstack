/**
 * LO Alignment Service for Capstone Pipeline
 * Calculates how well projects align with course learning objectives
 * Adapted from EduThree1's alignment-service.ts using SyllabusStack's AI client
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

Alignment Explanation:
${loAlignment}

Return ONLY a JSON object:
{"coverage_percentage": <0-100 number>, "outcomes_covered": ["LO1", "LO3"], "gaps": ["explanation"]}`;

    const result = await generateText({
      prompt,
      systemPrompt: 'You are a learning outcomes assessment expert. Return only valid JSON.',
      options: { model: MODELS.FAST, temperature: 0.3 },
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
 * Calculate Market Alignment Score (keyword-based, no API calls)
 * Returns 0-100 score
 */
export function calculateMarketAlignmentScore(
  projectTasks: string[],
  objectives: string[],
  jobPostings: any[],
  technologiesUsed: string[]
): number {
  let score = 0;

  // Build keyword set from objectives
  const keywords = new Set<string>();
  objectives.forEach(o => {
    o.toLowerCase().split(/[\s,]+/).forEach(w => {
      if (w.length > 4) keywords.add(w);
    });
  });

  const taskText = projectTasks.join(' ').toLowerCase();

  // Job alignment (50 points max)
  if (jobPostings.length > 0) {
    let matched = 0;
    for (const job of jobPostings) {
      const jobText = `${job.title || ''} ${job.description || ''}`.toLowerCase();
      if (Array.from(keywords).some(kw => jobText.includes(kw))) matched++;
    }
    score += (matched / jobPostings.length) * 50;
  }

  // Tech alignment (50 points max)
  if (technologiesUsed.length > 0) {
    const matchedTech = technologiesUsed.filter(tech => {
      const t = (typeof tech === 'string' ? tech : '').toLowerCase();
      return Array.from(keywords).some(kw => t.includes(kw) || kw.includes(t));
    });
    score += (matchedTech.length / technologiesUsed.length) * 50;
  }

  return Math.round(score);
}
