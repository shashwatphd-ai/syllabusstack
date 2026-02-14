/**
 * Content Role Reasoner
 *
 * Uses an LLM to reason about what kinds of videos would be valuable
 * for a given learning objective — not just tutorials, but curiosity sparks,
 * real-world cases, practitioner perspectives, debates, and adjacent insights.
 *
 * This is the "think like a curious teacher" step that runs before query generation.
 */

import { generateText, MODELS, parseJsonResponse } from '../../unified-ai-client.ts';
import type { QueryGenerationContext, ContentBrief, ContentRole } from '../types.ts';
import { validateContentBrief } from './validate-content-brief.ts';

const ROLE_REASONING_PROMPT = `You are a creative, curious educator designing a rich learning experience. Given a learning objective, you must think about what kinds of YouTube videos would make this topic come alive for students.

Do NOT just think about tutorials and lectures. Think about:
- What real-world events, industries, or phenomena involve this concept?
- What would make a student say "I didn't know that was connected to this!"?
- What practitioners (engineers, doctors, economists, journalists) discuss this accessibly?
- What debates or controversies exist around this topic?
- What adjacent topics would deepen understanding through contrast or analogy?
- What news stories, documentaries, or podcast clips illuminate this?

Return a JSON object with this structure:
{
  "roles": [
    {
      "role": "core_explainer",
      "description": "A clear tutorial or lecture that teaches the concept directly",
      "target_content_types": ["tutorial", "lecture", "explainer"],
      "suggested_queries": ["2-3 specific YouTube search queries"],
      "duration_flexibility": "strict"
    },
    {
      "role": "curiosity_spark",
      "description": "Something that makes the topic feel surprising or personally relevant",
      "target_content_types": ["short video", "science communication", "pop science"],
      "suggested_queries": ["2-3 creative search queries targeting fascinating angles"],
      "duration_flexibility": "any"
    },
    {
      "role": "real_world_case",
      "description": "A concrete example of this concept in the real world",
      "target_content_types": ["news clip", "documentary", "case study"],
      "suggested_queries": ["2-3 queries targeting real events or applications"],
      "duration_flexibility": "flexible"
    }
  ],
  "real_world_connections": ["3-5 real-world phenomena, events, or industries connected to this concept"]
}

RULES:
- Always include "core_explainer" as the first role
- Include 3-5 roles total (pick from: core_explainer, curiosity_spark, real_world_case, practitioner_perspective, debate_or_analysis, adjacent_insight)
- Each role must have 2-3 suggested_queries that are specific and creative
- Queries should be what a curious person would actually type into YouTube
- Do NOT use generic queries like "concept explained" — be specific and creative
- Keep queries concise (3-7 words each)
- Do NOT include controversial, political, or divisive content suggestions
- Return ONLY valid JSON, no markdown`;

/**
 * Generate a ContentBrief using LLM reasoning about what kinds of videos
 * would make a learning objective come alive.
 *
 * @param context - The learning objective and course/module context
 * @param timeoutMs - Timeout for the LLM call (default 5000ms)
 * @returns ContentBrief or null if reasoning fails (caller should fall back)
 */
export async function generateContentBrief(
  context: QueryGenerationContext,
  timeoutMs: number = 5000
): Promise<ContentBrief | null> {
  const lo = context.learningObjective;

  const userPrompt = `Learning Objective: "${lo.text}"
Core Concept: ${lo.core_concept}
Bloom's Level: ${lo.bloom_level}
Domain: ${lo.domain}
${context.module ? `Module: ${context.module.title}` : ''}
${context.course ? `Course: ${context.course.title}` : ''}
${lo.search_keywords?.length > 0 ? `Keywords: ${lo.search_keywords.join(', ')}` : ''}

Think creatively about what videos would make "${lo.core_concept}" fascinating and deeply understood. Return the JSON content brief.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const result = await generateText({
      prompt: userPrompt,
      systemPrompt: ROLE_REASONING_PROMPT,
      model: MODELS.PROFESSOR_AI, // Gemini 3 Flash — best quality/speed for creative reasoning
      temperature: 0.7, // Higher temperature for creative reasoning
      logPrefix: '[content-role-reasoner]',
    });

    clearTimeout(timeout);

    if (!result.content) {
      console.log('[content-role-reasoner] No content in LLM response');
      return null;
    }

    const parsed = parseJsonResponse(result.content);

    const validated = validateContentBrief(parsed, lo.core_concept);
    if (!validated) {
      console.log('[content-role-reasoner] Invalid response structure - no roles');
      return null;
    }

    console.log(`[content-role-reasoner] Generated brief with ${validated.roles.length} roles: ${validated.roles.map(r => r.role).join(', ')}`);

    return validated;
  } catch (error) {
    console.log('[content-role-reasoner] Failed (will fall back to standard queries):', error);
    return null;
  }
}
