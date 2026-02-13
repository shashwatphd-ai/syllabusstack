// ============================================================================
// SHARED SLIDE PROMPTS - Single source of truth for Professor AI prompt
// ============================================================================
//
// CANONICAL SOURCE: Extracted from generate-lecture-slides-v3/index.ts
// Used by: generate-lecture-slides-v3, generate-batch-slides
//
// This file eliminates the prompt drift problem where 3 copies of
// PROFESSOR_SYSTEM_PROMPT had diverged (179, 130, 105 lines).
// Now there is ONE canonical prompt used everywhere.
//

import type { TeachingUnitContext, ResearchContext } from './slide-types.ts';

// ============================================================================
// PROFESSOR AI SYSTEM PROMPT (canonical, 179-line version from v3)
// ============================================================================

export const PROFESSOR_SYSTEM_PROMPT = `You are an expert university professor creating comprehensive, self-contained lecture slides. You have decades of teaching experience, deep subject matter expertise, and mastery of evidence-based pedagogy.

YOUR MISSION:
Create a complete slide deck that enables DEEP LEARNING. Every slide must provide substantive, textbook-quality content that students can study independently. NO superficial bullet points or vague phrases—only thorough, academically rigorous explanations.

CORE TEACHING PHILOSOPHY:
- Write as if this is the student's PRIMARY learning resource (not supplementary)
- Every concept deserves a proper textbook-style definition followed by detailed explanation
- Abstract ideas must be grounded in concrete, real-world examples with verifiable data
- Build understanding step-by-step, never assuming the student will "figure it out"
- Anticipate confusion and address it proactively

PEDAGOGICAL STRUCTURE:
1. ACTIVATE prior knowledge (connect explicitly to prerequisites they've learned)
2. HOOK with real-world relevance (use specific statistics, case studies, or current events)
3. DEFINE every new term with:
   a) Formal academic definition (as found in authoritative textbooks)
   b) Plain-language explanation of what this means in practice
   c) Why this concept matters in the field
4. EXPLAIN the underlying reasoning (not just WHAT, but WHY and HOW)
5. ILLUSTRATE with concrete examples that include:
   a) Specific real-world scenarios with actual data when possible
   b) Step-by-step walkthrough of application
   c) Connection back to the abstract concept
6. ADDRESS misconceptions explicitly—name the wrong belief, explain why it's wrong, provide the correct understanding
7. SYNTHESIZE by connecting concepts to each other and the bigger picture
8. PREVIEW upcoming content to build anticipation and show learning progression

SLIDE TYPES (use appropriately):
- title: Opening that hooks attention with real-world relevance and clear learning objectives
- hook: Why students should care—use statistics, trends, career implications, or compelling scenarios
- recap: Connect to prerequisites with specific callbacks to prior learning
- definition: COMPREHENSIVE treatment—formal definition + explanation + significance + example
- explanation: Detailed conceptual exploration with reasoning, cause-effect relationships, and context
- example: Rich, detailed real-world application with specific data, names, dates when relevant
- demonstration: Step-by-step walkthrough with explicit reasoning at each step
- process: Multi-step procedures with clear explanations of why each step matters
- misconception: Directly address wrong beliefs—state the misconception, explain why it's wrong, provide correct understanding
- practice: Guided mental exercise with thinking prompts
- synthesis: Connect multiple concepts, show relationships, build bigger picture
- summary: Consolidate key learning points with actionable takeaways
- preview: Foreshadow next topics, create anticipation, show learning path

CONTENT DEPTH REQUIREMENTS:

1. main_text: 3-4 substantive sentences that TEACH, not tease. Include:
   - Core concept or principle being taught
   - Why it matters or how it applies
   - Connection to broader context or real-world implications

2. key_points: 4-5 detailed bullet points where each point:
   - Makes a complete, educational statement (not fragments)
   - Explains the WHY behind the WHAT
   - Includes specific details, data, or examples where relevant
   - Stands alone as a learnable piece of information

   BAD: "Important for analysis"
   GOOD: "Critical for data analysis because it reveals patterns that would be invisible in raw numbers—for instance, identifying that 80% of customer complaints come from just 20% of product categories enables targeted improvement efforts"

3. definition blocks (when introducing concepts):
   - term: The exact term being defined
   - formal_definition: Textbook-quality definition with precision
   - simple_explanation: Plain-language version with analogy if helpful
   - significance: Why this concept matters in the field (1-2 sentences)
   - example: Brief concrete instance showing the concept in action

4. example blocks (rich and specific):
   - scenario: Detailed, realistic situation with specifics (company names, data, context)
   - walkthrough: Step-by-step explanation of how the concept applies
   - connection_to_concept: Explicit link back to the abstract principle
   - real_world_data: Include actual statistics, case study references, or verifiable facts when possible

5. speaker_notes: 200-350 words of CONVERSATIONAL MASTERY narration. These notes
   will be read verbatim by text-to-speech, so write them as a continuous spoken
   monologue — not bullet points, not stage directions, not meta-commentary.

   VOICE AND STYLE:
   - Write as a warm, intellectually generous mentor speaking directly to the student
   - Use direct address: "Now, you might be wondering...", "Let me show you why..."
   - Think aloud: "If we look at it this way... but wait, that creates a problem..."
   - Use everyday analogies to ground abstract concepts (family dynamics, household
     economics, popular culture, common experiences)
   - Include well-timed observational humor when cognitive load is heaviest
   - Pose rhetorical questions, then answer them yourself

   PEDAGOGICAL STRUCTURE:
   - Start from zero — never assume prior knowledge on this specific point
   - Build brick by brick — each new idea connects to the previous one
   - Layer complexity gradually — foundation first, then nuance and exceptions
   - End with synthesis — connect back to the bigger picture

   ABSOLUTE RULES FOR SPOKEN NARRATION:
   - NEVER say "Exactly!", "Great point!", "That's crucial!", or any phrase implying
     someone else is speaking. This is a monologue — the student has said nothing.
   - NEVER read citations verbatim (e.g., "Sull et al., 2015"). Convert to natural
     speech: "researchers found..." or "a major workplace study showed..."
   - NEVER include [Source N] markers — these are visual artifacts, not spoken content
   - NEVER read URLs aloud. Convert to natural references.
   - Each slide's notes should flow naturally from the previous slide's content.
     Use transitions like "Building on that...", "Now let's look at...",
     "Here's where it gets interesting..."

6. MANDATORY COVERAGE:
   - Every common_misconception from the brief MUST have a dedicated slide
   - Every required_concept MUST be formally defined before use
   - Prerequisites must be explicitly referenced in the recap
   - The enables/next topics must be mentioned in the preview slide

VISUAL DIRECTIVES:
Specify visuals that genuinely enhance understanding:
- type: diagram/screenshot/comparison/flowchart/illustration/chart/infographic/none
- description: 50-100 word description for AI image generation. Specify diagram type (flowchart/radial/comparison/matrix), exact element positions (left/right/center), specific labels from the content, and color meaning. Must be specific enough that two different artists would produce similar diagrams.
- elements: Array of 3-6 specific labeled elements that MUST appear, using exact terms from the content
- style: "clean technical diagram", "annotated screenshot", "minimalist academic", "data visualization", etc.
- educational_purpose: What concept this visual helps explain

VISUAL DIRECTIVE QUALITY REQUIREMENTS (CRITICAL):
- description: Must be 50+ words, highly specific to the educational content
- Avoid generic visuals like "people connecting", "trophy", "lightbulb", "gears turning"
- Describe the EXACT visual representation of the concept being taught
- Include specific labels, data points, or framework components in the description
- Match the domain terminology (e.g., for management: "Strategic Analysis Matrix with 4 quadrants labeled...")

BAD EXAMPLE: "A diagram showing communication between people"
GOOD EXAMPLE: "A horizontal flowchart showing the AIDA model: four connected boxes labeled 'Attention' (with eye icon), 'Interest' (with lightbulb), 'Desire' (with heart), and 'Action' (with checkmark). Arrows flow left to right. Below each box, include a one-line example from digital marketing context. Use clean academic style with blue gradient headers."

QUALITY STANDARDS:
- NO vague phrases like "important for business" or "useful in practice"—be SPECIFIC
- NO unexplained jargon—every technical term gets a definition
- NO orphaned concepts—everything connects to something the student knows
- NO abstract-only explanations—always ground in concrete examples
- NO filler content—every sentence must teach something

 BANNED RHETORICAL PATTERNS (hollow content that sounds profound but teaches nothing):

 1. CONTRAST FRAMING: "This isn't about tools. It's about mindset."
    → Delete and rewrite with specifics: WHAT about mindset? HOW does it differ?

 2. SYNTHETIC REPETITION: "Clarity matters. Precision matters. Intent matters."
    → Delete: three synonyms, zero new information.

 3. TRIADIC CLOSURE: "People. Process. Technology."
    → Delete: three nouns without explanation. What ABOUT them?

 4. DECLARATIVE AUTHORITY: "AI is reshaping the future of work."
    → Delete: unfalsifiable. Which AI? Which work? How? When?

 5. PERFORMATIVE VULNERABILITY: "I used to think this way. I was wrong."
    → Delete: borrows credibility without contributing detail.

 6. DISCOMFORT SIGNALING: "Here's an uncomfortable truth..."
    → Delete: the framing carries weight the argument hasn't earned.

 If you catch yourself using these patterns, the sentence is carrying no educational weight.
 State claims with specifics, evidence, and mechanisms instead.

 QUALITY REFERENCE EXAMPLES:

 === main_text (50-80 words, not essay-length) ===
 BAD: "Leadership is important for organizations. It helps teams succeed."
 GOOD: "Teams with highly engaged leaders outperform peers by 147% in earnings per share, according to Gallup's 2023 State of the Workplace report [Source 1]. The mechanism is psychological safety—when team members can take risks without fear of punishment, problems surface earlier and solutions emerge faster."

 === misconception block (structured, evidence-based) ===
 BAD: { "wrong_belief": "Communication is easy", "why_wrong": "It's hard", "correct_understanding": "Do it right" }
 GOOD: {
   "wrong_belief": "Managers believe sending a well-crafted email constitutes 'communication.' Once sent, job done.",
   "why_wrong": "Communication isn't 'received' because it was 'sent.' Sull et al. (2015) found strategic messages lose 50-80% of meaning through organizational layers—the 'resemblance gap' [Source 2].",
   "correct_understanding": "Effective communication requires: (1) multi-channel delivery, (2) feedback to confirm understanding ('explain this to a new hire'), (3) contextual relevance for each team's daily work."
 }

 === visual_directive (50+ words, domain-specific elements) ===
 BAD: { "description": "A diagram showing communication", "elements": ["people", "arrows"] }
 GOOD: { "description": "Vertical flowchart: 'Strategy Communication Cascade.' Top box 'Executive Vision' (100% message fidelity). Three arrows down to 'Division Translation' (70%), 'Team Contextualization' (45%), 'Individual Action' (23%). Right side: orange 'Feedback Loop' arrow pointing up with checkpoints 'Comprehension Check', 'Barrier Identification', 'Adaptation Signal'.", "elements": ["Executive Vision box", "Division/Team/Individual boxes with % labels", "Feedback Loop arrow with 3 checkpoints"], "educational_purpose": "Visualize message degradation through organizational layers" }

RAG (RETRIEVAL-AUGMENTED GENERATION) RULES:
When a "RESEARCH GROUNDING" section is provided in the brief:

1. CITATION MANDATE:
   - You MUST use the verified facts from the research grounding section
   - Every slide that uses a grounded fact must include [Source N] in the content
   - Store the full citation in the slide's metadata for footer display

2. NO HALLUCINATION RULE:
   - If the research does not contain a specific statistic, DO NOT invent one
   - Use phrases like "Research indicates..." or "According to established frameworks..."
   - Never fabricate case studies, dates, or numerical data

3. SOURCE ATTRIBUTION:
   - For definition slides: Use the exact definition from research, cite source
   - For example slides: Use real cases from research, or clearly mark as "Illustrative example"
   - For misconception slides: Cross-reference with research corrections if available

4. VISUAL ACCURACY:
   - If research includes visual descriptions (e.g., "Porter's Five Forces has 5 forces..."),
     use that EXACT structure in your visual_directive elements
   - Never invent framework components not mentioned in research

5. FALLBACK BEHAVIOR:
   - If research says "No external research available", you may use training data
   - Mark such content with lower confidence and add "(illustrative)" to examples
   - Include a note in speaker_notes that this is based on general knowledge

OUTPUT FORMAT: JSON with exact structure shown below.`;

// ============================================================================
// LECTURE BRIEF BUILDER - Comprehensive prompt assembly
// ============================================================================

export function buildLectureBrief(context: TeachingUnitContext): string {
  const sequenceContext = context.sibling_units.map((unit, i) => {
    const status = unit.id === context.id
      ? '<-- GENERATING THIS'
      : i < context.sequence_position - 1
        ? '(COMPLETED)'
        : '(UPCOMING)';
    return `${unit.sequence_order}. ${unit.title} - ${unit.what_to_teach?.slice(0, 100) || 'No description'} ${status}`;
  }).join('\n');

  return `
=== COURSE CONTEXT ===
Course: ${context.course.title} (${context.course.code || 'No code'})
Domain: ${context.domain}
${context.syllabus_text ? `Syllabus excerpt: ${context.syllabus_text.slice(0, 500)}...` : ''}

=== MODULE CONTEXT ===
Module: ${context.module.title}
Description: ${context.module.description || 'No description provided'}

=== LEARNING OBJECTIVE ===
"${context.learning_objective.text}"
Bloom Level: ${context.learning_objective.bloom_level}
Core Concept: ${context.learning_objective.core_concept}
Action Verb: ${context.learning_objective.action_verb}

=== TEACHING UNIT SEQUENCE (Full Learning Objective) ===
${sequenceContext}

=== CURRENT TEACHING UNIT: ${context.title} ===

WHAT TO TEACH:
${context.what_to_teach}

WHY THIS MATTERS:
${context.why_this_matters}

HOW TO TEACH:
${context.how_to_teach || 'Use clear explanations with concrete examples'}

PREREQUISITES (assume student knows):
${context.prerequisites.length > 0 ? context.prerequisites.map(p => `- ${p}`).join('\n') : '- None specified'}

ENABLES (what this unlocks):
${context.enables.length > 0 ? context.enables.map(e => `- ${e}`).join('\n') : '- None specified'}

COMMON MISCONCEPTIONS (must address):
${context.common_misconceptions.length > 0 ? context.common_misconceptions.map(m => `- ${m}`).join('\n') : '- None specified'}

REQUIRED CONCEPTS (must define):
${context.required_concepts.length > 0 ? context.required_concepts.map(c => `- ${c}`).join('\n') : '- Derive from what_to_teach'}

TERMS TO AVOID (confusing for students):
${context.avoid_terms.length > 0 ? context.avoid_terms.map(t => `- ${t}`).join('\n') : '- None specified'}

TARGET DURATION: ${context.target_duration_minutes} minutes
TARGET STYLE: ${context.target_video_type}
TEACHING UNIT POSITION: ${context.sequence_position} of ${context.total_siblings} in this learning objective
`.trim();
}

// ============================================================================
// RESEARCH MERGER - Inject grounded content into lecture brief
// ============================================================================

export function mergeResearchIntoBrief(
  baseBrief: string,
  research: ResearchContext
): string {
  if (research.grounded_content.length === 0) {
    return baseBrief + `

=== RESEARCH GROUNDING ===
No external research available. Generate content from your training data.
Mark any statistics or case studies as "illustrative examples" rather than verified facts.`;
  }

  const groundedSection = `

=== RESEARCH GROUNDING (MANDATORY TO USE) ===

VERIFIED DEFINITIONS AND FACTS:
${research.grounded_content.slice(0, 10).map((c, i) =>
  `[Source ${i + 1}] "${c.claim}"
   Citation: ${c.source_title} (${c.source_url})`
).join('\n\n')}

${research.recommended_reading.length > 0 ? `
RECOMMENDED READING (for "Further Reading" slide):
${research.recommended_reading.slice(0, 5).map(r =>
  `- ${r.title} [${r.type}]: ${r.url}`
).join('\n')}
` : ''}

${research.visual_descriptions?.length > 0 ? `
VISUAL FRAMEWORK DESCRIPTIONS (use EXACT structure for diagrams):
${research.visual_descriptions.map(v =>
  `- ${v.framework_name}: ${v.description}
   Elements: ${v.elements.join(', ')}`
).join('\n')}
` : ''}

CITATION RULES (CRITICAL):
- You MUST use the verified definitions above, NOT your training data
- Every factual claim must include [Source N] marker in the slide content
- If a statistic is NOT in the research, clearly mark as "According to industry practice..."
- Use the visual descriptions to guide EXACT diagram element composition
- Include a "Sources" or "Further Reading" slide at the end`;

  return baseBrief + groundedSection;
}

// ============================================================================
// USER PROMPT BUILDER - Builds the full user prompt for Professor AI
// ============================================================================

export function buildUserPrompt(
  context: TeachingUnitContext,
  groundedBrief: string,
  targetSlides: number = 6
): string {
  return `${groundedBrief}

=== YOUR TASK ===
Create a comprehensive ${targetSlides}-slide lecture deck for this teaching unit.

CRITICAL REQUIREMENTS:
1. Every common_misconception MUST have a dedicated "misconception" slide that:
   - States the wrong belief explicitly
   - Explains WHY students typically believe this
   - Provides the correct understanding with evidence

2. Every required_concept MUST be defined with:
   - Formal academic definition (textbook quality)
   - Plain-language explanation
   - Real-world example showing the concept in action
   - Why this concept matters in the field

3. Speaker notes MUST be 200-350 words of Conversational Mastery narration:
   - Written as a continuous spoken monologue (will be read by TTS verbatim)
   - Warm, conversational tone with everyday analogies and rhetorical questions
   - NO citation markers [Source N], NO "Exactly!", NO reading URLs aloud
   - Natural transitions from the previous slide's content

4. Bloom level "${context.learning_objective.bloom_level}" dictates cognitive depth:
   - remember: Emphasize clear definitions, memorable examples, key facts
   - understand: Focus on explanations, reasoning, cause-effect relationships
   - apply: Provide worked examples, step-by-step demonstrations, practical scenarios
   - analyze: Compare/contrast, examine relationships, break down components
   - evaluate: Include criteria for judgment, pros/cons analysis, critical assessment
   - create: Show design processes, synthesis of components, novel applications

5. CONTENT DEPTH:
   - main_text: 3-4 substantive sentences that teach a complete idea
   - key_points: 4-5 detailed bullets, each making a complete educational statement with explanations
   - examples: Use specific, verifiable real-world data (company names, statistics, case studies)
   - NO vague phrases—be specific and educational

6. ADAPTIVE LAYOUT HINTS (AI-driven content presentation):
   For EACH key_point, analyze its semantic structure and provide an optional layout_hint:
   - Describes a sequence/process (A \u2192 B \u2192 C) \u2192 type: "flow", segments: ["Step A", "Step B", "Step C"]
   - Compares two things (X vs Y, X = this; Y = that) \u2192 type: "comparison", left_right: ["X", "Y"]
   - Contains formula/relationship (X = Y + Z) \u2192 type: "equation", formula: "X = Y + Z"
   - Notable quote or key principle \u2192 type: "quote"
   - Important insight or tip \u2192 type: "callout"
   - Multiple items in a list \u2192 type: "list"
   - Simple paragraph \u2192 type: "plain"
   - Always include emphasis_words: 2-4 critical terms to highlight

7. OPTIONAL FIELDS HANDLING (CRITICAL):
   - The fields "definition", "example", "misconception", and "steps" are OPTIONAL
   - ONLY include these fields if the slide type genuinely warrants them
   - DO NOT fill optional fields with "N/A", "Not applicable", placeholder text, or empty values
   - If a field doesn't apply to the slide type, OMIT the key entirely from the JSON
   - For example: a "title" slide should NOT have a "misconception" or "example" block
   - A "definition" slide SHOULD have a "definition" block but NOT "misconception"

   WRONG (do not do this):
   "misconception": { "wrong_belief": "N/A", "why_wrong": "N/A", "correct_understanding": "N/A" }

   CORRECT (omit entirely when not applicable):
   // No misconception key at all for title/definition slides

OUTPUT (JSON array of slides):
{
  "slides": [
    {
      "order": 1,
      "type": "title",
      "title": "Engaging title that frames the learning journey",
      "content": {
        "main_text": "3-4 substantive sentences that introduce the topic...",
        "main_text_layout": {
          "type": "plain",
          "emphasis_words": ["critical term", "key concept"]
        },
        "key_points": [
          "Process: Set Direction \u2192 Analyze Environment \u2192 Implement \u2192 Review",
          "Vision defines the future state; Mission defines present purpose"
        ],
        "key_points_layout": [
          { "type": "flow", "segments": ["Set Direction", "Analyze", "Implement", "Review"] },
          { "type": "comparison", "left_right": ["Vision (Future)", "Mission (Present)"] }
        ]
      },
      "visual_directive": {
        "type": "illustration",
        "description": "Detailed description for image generation",
        "elements": ["element1", "element2"],
        "style": "clean academic",
        "educational_purpose": "What this visual helps students understand"
      },
      "speaker_notes": "200-350 words of conversational mastery narration (spoken monologue, no citations)...",
      "estimated_seconds": 90,
      "pedagogy": {
        "purpose": "Hook attention and establish real-world relevance",
        "bloom_action": "activate prior knowledge and create motivation",
        "transition_to_next": "Now that we understand why this matters, let's define the foundational concepts..."
      }
    }
  ]
}

CRITICAL: Every slide MUST have speaker_notes with 200-350 words of conversational narration written as a spoken monologue. Never leave speaker_notes empty or short.
Generate all ${targetSlides} slides now with RICH, EDUCATIONAL content and LAYOUT HINTS for every key_point.`;
}

// ============================================================================
// JSON PARSER - Extract JSON from AI responses
// ============================================================================

export function parseJsonFromAI(content: string): any {
  if (!content || !content.trim()) {
    throw new Error('Empty AI response content');
  }

  const raw = content.trim();

  // Strategy 1: Extract from markdown code block
  // Use greedy approach: find first ``` opener and LAST ``` closer
  const codeBlockStart = raw.match(/```(?:json)?\s*/);
  if (codeBlockStart) {
    const contentStart = codeBlockStart.index! + codeBlockStart[0].length;
    const lastFence = raw.lastIndexOf('```');
    // Ensure the last fence is after the content start (not the same opening fence)
    if (lastFence > contentStart) {
      try {
        return JSON.parse(raw.substring(contentStart, lastFence).trim());
      } catch (_e) {
        // Fall through to other strategies
      }
    }
  }

  // Strategy 2: Find the outermost JSON object or array
  const firstBrace = raw.indexOf('{');
  const firstBracket = raw.indexOf('[');
  const jsonStart = firstBrace === -1 ? firstBracket :
                    firstBracket === -1 ? firstBrace :
                    Math.min(firstBrace, firstBracket);

  if (jsonStart !== -1) {
    const isArray = raw[jsonStart] === '[';
    const closeChar = isArray ? ']' : '}';
    const lastClose = raw.lastIndexOf(closeChar);
    if (lastClose > jsonStart) {
      try {
        return JSON.parse(raw.substring(jsonStart, lastClose + 1));
      } catch (_e) {
        // Fall through
      }
    }
  }

  // Strategy 3: Repair truncated JSON (model hit token limit)
  // Find the JSON start, then close all open braces/brackets
  if (jsonStart !== -1) {
    let candidate = raw.substring(jsonStart);
    // Remove trailing incomplete string/value (cut at last complete property)
    const lastCompleteComma = candidate.lastIndexOf(',\n');
    const lastCompleteBrace = candidate.lastIndexOf('}\n');
    const cutPoint = Math.max(lastCompleteComma, lastCompleteBrace);
    if (cutPoint > 0) {
      candidate = candidate.substring(0, cutPoint + 1);
    }
    // Count open vs close braces/brackets and append missing closers
    let openBraces = 0, openBrackets = 0;
    let inString = false, escaped = false;
    for (const ch of candidate) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') openBraces++;
      else if (ch === '}') openBraces--;
      else if (ch === '[') openBrackets++;
      else if (ch === ']') openBrackets--;
    }
    // Close any remaining open structures
    const closers = ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
    if (closers.length > 0) {
      try {
        const repaired = JSON.parse(candidate + closers);
        console.warn(`[parseJsonFromAI] Repaired truncated JSON by appending ${closers.length} closing chars`);
        return repaired;
      } catch (_e) {
        // Fall through
      }
    }
  }

  // Strategy 4: Try parsing the raw content directly
  try {
    return JSON.parse(raw);
  } catch (_e) {
    const preview = raw.length > 500 ? raw.substring(0, 250) + '\n...[truncated]...\n' + raw.substring(raw.length - 250) : raw;
    console.error('[parseJsonFromAI] All strategies failed. Content preview:', preview);
    console.error('[parseJsonFromAI] Content length:', raw.length, 'First 20 chars:', JSON.stringify(raw.substring(0, 20)));
    throw new Error(`Failed to parse JSON from AI response (${raw.length} chars). Preview: ${raw.substring(0, 100)}`);
  }
}
