/**
 * Student Search Agent
 *
 * Assumes the perspective of a student who just consumed a lecture's teaching
 * content — what was taught, why it matters, how it was taught, common
 * misconceptions, prerequisites, and what it enables next.
 *
 * From that grounded position, the agent generates YouTube search queries
 * that a curious student would actually type: questions driven by real
 * confusion, forward curiosity, and desire for concrete examples.
 *
 * This replaces the "curious teacher" approach (content-role-reasoner.ts)
 * as the primary search strategy when teaching unit content is available.
 * Falls back to the teacher approach when no teaching context exists.
 */

import { generateText, MODELS, parseJsonResponse } from '../../unified-ai-client.ts';
import type { QueryGenerationContext, ContentBrief, TeachingContext } from '../types.ts';
import { validateContentBrief } from './validate-content-brief.ts';

/**
 * Build the "lecture you just attended" narrative from teaching context.
 * Transforms structured pedagogical data into a student-perspective narrative.
 */
function buildStudentContext(teaching: TeachingContext): string {
  const sections: string[] = [];

  sections.push(`WHAT I JUST LEARNED:\n${teaching.what_to_teach}`);

  if (teaching.why_this_matters) {
    sections.push(`WHY THE PROFESSOR SAID THIS MATTERS:\n${teaching.why_this_matters}`);
  }

  if (teaching.how_to_teach) {
    sections.push(`HOW IT WAS TAUGHT TO ME:\n${teaching.how_to_teach}`);
  }

  if (teaching.common_misconceptions?.length) {
    sections.push(
      `THINGS I MIGHT BE CONFUSED ABOUT (common mistakes students make):\n` +
      teaching.common_misconceptions.map((m, i) => `${i + 1}. ${m}`).join('\n')
    );
  }

  if (teaching.prerequisites?.length) {
    sections.push(`WHAT I NEEDED TO KNOW BEFORE THIS:\n${teaching.prerequisites.join(', ')}`);
  }

  if (teaching.enables?.length) {
    sections.push(`WHAT THIS UNLOCKS NEXT:\n${teaching.enables.join(', ')}`);
  }

  if (teaching.required_concepts?.length) {
    sections.push(`KEY CONCEPTS I NEED TO MASTER:\n${teaching.required_concepts.join(', ')}`);
  }

  return sections.join('\n\n');
}

const STUDENT_SEARCH_PROMPT = `You are a college student who just left a lecture. You took good notes, you mostly followed along, but now you want to go deeper. You're about to open YouTube to find videos that will help you truly understand what was covered.

You are NOT a teacher planning a lesson. You are NOT an AI assistant. You are a real student with real questions, real confusions, and real curiosity about what you just learned.

Given the lecture content you just absorbed, think through these stages and generate YouTube search queries for EACH:

1. CLARIFICATION NEEDS (core_explainer): "What parts am I still fuzzy on? What would I search to get a clearer explanation?"
   → Generate queries for the best tutorial/explainer on this exact concept. Maybe a different explanation style would click better than the lecture.

2. CURIOSITY SPARKS (curiosity_spark): "Something about this fascinated me. I want to know more about the surprising or interesting angles."
   → Generate queries for content that would make you say "wow, I didn't know that was connected!"

3. REAL-WORLD EXAMPLES (real_world_case): "Where does this show up in the real world? I want to SEE this concept in action."
   → Generate queries for news clips, case studies, documentaries, or real events that demonstrate this concept.

4. EXPERT VOICES (practitioner_perspective): "Who actually works with this? I want to hear from someone who uses this in their career."
   → Generate queries for interviews, talks, or practitioners discussing this topic from experience.

5. DEEPER THINKING (debate_or_analysis): "Are there different viewpoints? What are the trade-offs or debates around this?"
   → Generate queries for nuanced analysis, debates, or critical examination of this topic.

SPECIAL RULE: If common misconceptions are listed, at least ONE role MUST specifically target clarifying those confusions. This is the content that will help the most.

Return a JSON object with this structure:
{
  "roles": [
    {
      "role": "core_explainer",
      "description": "What I want to understand better and why",
      "target_content_types": ["tutorial", "lecture", "explainer"],
      "suggested_queries": ["2-3 queries I would actually type into YouTube"],
      "duration_flexibility": "strict"
    }
  ],
  "real_world_connections": ["3-5 specific real-world things I now realize connect to this"]
}

RULES:
- Always include "core_explainer" as the first role
- Include 3-5 roles total (from: core_explainer, curiosity_spark, real_world_case, practitioner_perspective, debate_or_analysis, adjacent_insight)
- Each role must have 2-3 suggested_queries
- Queries MUST be what a STUDENT would actually type into YouTube — casual, specific, curious
- NOT teacher language: no "pedagogy", "curriculum", "scaffolding", "learning outcomes"
- If misconceptions are provided, use them to drive at least one targeted search
- Keep queries concise (3-7 words each) — real YouTube searches, not essay titles
- Do NOT include controversial, political, or divisive content suggestions
- Return ONLY valid JSON, no markdown`;

/**
 * Generate a ContentBrief from the student's perspective.
 *
 * When teaching context is available (what_to_teach, misconceptions, etc.),
 * the agent reasons from the student's position after consuming that content.
 *
 * When no teaching context exists, falls back to the content-role-reasoner
 * (teacher perspective) for backward compatibility.
 */
export async function generateStudentSearchBrief(
  context: QueryGenerationContext,
  timeoutMs: number = 6000
): Promise<ContentBrief | null> {
  // Graceful fallback: no teaching context → use the existing teacher-perspective reasoner
  if (!context.teaching) {
    const { generateContentBrief } = await import('./content-role-reasoner.ts');
    return generateContentBrief(context, timeoutMs);
  }

  const lo = context.learningObjective;
  const studentContext = buildStudentContext(context.teaching);

  const userPrompt = `I just came from my ${context.course?.title || 'class'} lecture${context.module ? `, specifically the "${context.module.title}" section` : ''}.

${studentContext}

---

Learning Objective: "${lo.text}"
Core Concept: ${lo.core_concept}
Bloom's Level: ${lo.bloom_level}
Domain: ${lo.domain}
${lo.search_keywords?.length > 0 ? `Key Terms: ${lo.search_keywords.join(', ')}` : ''}

Now I'm opening YouTube. What would I search for? Think about what genuinely interests me, what I'm confused about, and what I want to explore next. Generate my search plan as a JSON content brief.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const result = await generateText({
      prompt: userPrompt,
      systemPrompt: STUDENT_SEARCH_PROMPT,
      model: MODELS.PROFESSOR_AI,
      temperature: 0.7,
      logPrefix: '[student-search-agent]',
    });

    clearTimeout(timeout);

    if (!result.content) {
      console.log('[student-search-agent] No content in LLM response');
      return null;
    }

    const parsed = parseJsonResponse(result.content);

    const validated = validateContentBrief(parsed, lo.core_concept);
    if (!validated) {
      console.log('[student-search-agent] Invalid response structure - no roles');
      return null;
    }

    console.log(`[student-search-agent] Generated brief with ${validated.roles.length} roles: ${validated.roles.map(r => r.role).join(', ')}`);

    return validated;
  } catch (error) {
    console.log('[student-search-agent] Failed, falling back to content-role-reasoner:', error);
    // Fallback to teacher perspective on failure
    try {
      const { generateContentBrief } = await import('./content-role-reasoner.ts');
      return generateContentBrief(context, timeoutMs);
    } catch {
      return null;
    }
  }
}
