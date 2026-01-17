/**
 * Dynamic Term Extraction and Synonym Learning
 *
 * Extracts domain-specific terms from instructor_courses and learns synonyms automatically.
 * No hardcoded concept lists - everything is derived from the syllabus content.
 *
 * MIGRATION NOTES: Uses Google Cloud Generative Language API directly
 * - API endpoint: generativelanguage.googleapis.com/v1beta
 * - Model: gemini-2.5-flash for fast synonym learning
 * - API key: GOOGLE_CLOUD_API_KEY environment variable (standardized from GEMINI_API_KEY)
 * - Request format: Google's native format with contents and generationConfig
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export interface ExtractedTerm {
  term: string;
  frequency: number;
  context: string[];
  domain?: string;
}

export interface LearnedSynonym {
  canonical_term: string;
  synonyms: string[];
  domain: string;
  instructor_course_id?: string;
  confidence: number;
}

export interface DomainTerms {
  domain: string;
  terms: ExtractedTerm[];
  synonymMap: Map<string, string[]>;
}

/**
 * Universal stop words (language-independent educational terms)
 * These are truly universal and don't need to be dynamic
 */
const UNIVERSAL_STOP_WORDS = new Set([
  // English articles/prepositions
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'this', 'but', 'they',
  'have', 'had', 'what', 'when', 'where', 'who', 'which', 'why', 'how',
  // Universal educational verbs (Bloom's taxonomy)
  'understand', 'explain', 'describe', 'identify', 'analyze', 'evaluate',
  'apply', 'demonstrate', 'define', 'compare', 'contrast', 'discuss',
  'list', 'create', 'design', 'develop', 'implement', 'assess',
  // Educational context words
  'students', 'student', 'learn', 'learning', 'course', 'module',
  'unit', 'week', 'lecture', 'tutorial', 'assignment', 'exam',
  'ability', 'able', 'should', 'will', 'can', 'must', 'may',
]);

/**
 * Extract domain-specific terms from syllabus text
 * Returns terms ranked by importance (frequency * uniqueness)
 */
export function extractDomainTerms(
  syllabusText: string,
  existingTerms?: Set<string>
): ExtractedTerm[] {
  const termFrequency = new Map<string, { count: number; contexts: string[] }>();

  // Split into sentences for context
  const sentences = syllabusText.split(/[.!?]\s+/);

  for (const sentence of sentences) {
    // Extract n-grams (1 to 4 words)
    const words = sentence
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !UNIVERSAL_STOP_WORDS.has(w));

    // Unigrams
    for (const word of words) {
      if (word.length > 3) {
        addTerm(termFrequency, word, sentence);
      }
    }

    // Bigrams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      addTerm(termFrequency, bigram, sentence);
    }

    // Trigrams
    for (let i = 0; i < words.length - 2; i++) {
      const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      addTerm(termFrequency, trigram, sentence);
    }
  }

  // Convert to array and sort by frequency
  const terms: ExtractedTerm[] = [];
  for (const [term, data] of termFrequency) {
    // Skip if already known
    if (existingTerms?.has(term.toLowerCase())) continue;

    // Skip very common or very rare terms
    if (data.count < 2 || data.count > sentences.length * 0.5) continue;

    terms.push({
      term,
      frequency: data.count,
      context: data.contexts.slice(0, 3), // Keep up to 3 example contexts
    });
  }

  // Sort by frequency (descending)
  terms.sort((a, b) => b.frequency - a.frequency);

  return terms.slice(0, 100); // Return top 100 terms
}

function addTerm(
  map: Map<string, { count: number; contexts: string[] }>,
  term: string,
  context: string
) {
  const existing = map.get(term);
  if (existing) {
    existing.count++;
    if (existing.contexts.length < 3) {
      existing.contexts.push(context.substring(0, 100));
    }
  } else {
    map.set(term, { count: 1, contexts: [context.substring(0, 100)] });
  }
}

/**
 * Detect the academic domain from syllabus content
 */
export function detectDomain(syllabusText: string): string {
  const text = syllabusText.toLowerCase();

  // Domain indicators - these are detection heuristics, not synonyms
  const domainIndicators: Record<string, string[]> = {
    'business': ['marketing', 'management', 'finance', 'strategy', 'organization', 'economics', 'accounting', 'entrepreneurship'],
    'medicine': ['patient', 'diagnosis', 'treatment', 'clinical', 'disease', 'anatomy', 'physiology', 'pharmacology'],
    'engineering': ['design', 'system', 'mechanical', 'electrical', 'circuit', 'structure', 'thermodynamics', 'fluid'],
    'computer_science': ['algorithm', 'programming', 'software', 'database', 'network', 'computing', 'code', 'data structure'],
    'natural_science': ['experiment', 'hypothesis', 'molecule', 'cell', 'organism', 'physics', 'chemistry', 'biology'],
    'social_science': ['society', 'culture', 'behavior', 'psychology', 'sociology', 'anthropology', 'political'],
    'humanities': ['literature', 'history', 'philosophy', 'art', 'language', 'ethics', 'religion', 'culture'],
    'mathematics': ['theorem', 'proof', 'equation', 'calculus', 'algebra', 'geometry', 'statistics', 'probability'],
    'law': ['legal', 'contract', 'court', 'jurisdiction', 'liability', 'statute', 'regulation', 'rights'],
    'education': ['pedagogy', 'curriculum', 'assessment', 'instruction', 'classroom', 'teacher', 'learner'],
  };

  const scores: Record<string, number> = {};

  for (const [domain, indicators] of Object.entries(domainIndicators)) {
    scores[domain] = indicators.filter(ind => text.includes(ind)).length;
  }

  // Find domain with highest score
  let maxDomain = 'general';
  let maxScore = 0;

  for (const [domain, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxDomain = domain;
    }
  }

  // Require at least 2 indicators to assign a specific domain
  return maxScore >= 2 ? maxDomain : 'general';
}

/**
 * Learn synonyms for a term using AI
 */
export async function learnSynonymsWithAI(
  term: string,
  context: string[],
  domain: string
): Promise<string[]> {
  const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
  if (!apiKey) {
    console.log('[DYNAMIC-TERMS] No GOOGLE_CLOUD_API_KEY, skipping synonym learning');
    return [];
  }

  try {
    const prompt = `Given the academic term "${term}" in the context of ${domain}, provide 3-5 synonyms or closely related terms that could be used interchangeably in educational content searches.

Context examples where this term appears:
${context.slice(0, 2).map(c => `- "${c}"`).join('\n')}

Return ONLY a JSON array of strings, no explanation. Example: ["synonym1", "synonym2", "synonym3"]`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON array from response
    const match = text.match(/\[.*\]/s);
    if (match) {
      const synonyms = JSON.parse(match[0]) as string[];
      return synonyms.filter(s => typeof s === 'string' && s.length > 2);
    }
  } catch (e) {
    console.log(`[DYNAMIC-TERMS] AI synonym learning failed: ${e}`);
  }

  return [];
}

/**
 * Get or create learned synonyms for an instructor course
 * @param courseId - The instructor_course_id
 * @param syllabusText - Optional syllabus text to learn synonyms from
 */
export async function getLearnedSynonyms(
  courseId: string,
  syllabusText?: string
): Promise<Map<string, string[]>> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const synonymMap = new Map<string, string[]>();

  // Try to get cached synonyms for this course
  const { data: cached } = await supabase
    .from('learned_synonyms')
    .select('canonical_term, synonyms')
    .eq('instructor_course_id', courseId);

  if (cached && cached.length > 0) {
    for (const row of cached) {
      synonymMap.set(row.canonical_term.toLowerCase(), row.synonyms);
    }
    return synonymMap;
  }

  // Also get domain-level synonyms
  const { data: domainSynonyms } = await supabase
    .from('learned_synonyms')
    .select('canonical_term, synonyms')
    .is('instructor_course_id', null);

  if (domainSynonyms) {
    for (const row of domainSynonyms) {
      synonymMap.set(row.canonical_term.toLowerCase(), row.synonyms);
    }
  }

  // If we have syllabus text and no cached synonyms, learn new ones
  if (syllabusText && (!cached || cached.length === 0)) {
    console.log(`[DYNAMIC-TERMS] Learning synonyms for course ${courseId}`);
    const domain = detectDomain(syllabusText);
    const terms = extractDomainTerms(syllabusText);

    // Learn synonyms for top 20 terms (async, don't await all)
    const topTerms = terms.slice(0, 20);

    // Learn in background (fire and forget for speed)
    learnAndStoreSynonyms(supabase as any, courseId, domain, topTerms).catch(e => {
      console.log(`[DYNAMIC-TERMS] Background synonym learning error: ${e}`);
    });
  }

  return synonymMap;
}

/**
 * Background task to learn and store synonyms
 */
async function learnAndStoreSynonyms(
  supabase: any,  // Use 'any' to avoid strict generic inference issues
  courseId: string,
  domain: string,
  terms: ExtractedTerm[]
): Promise<void> {
  for (const term of terms) {
    try {
      const synonyms = await learnSynonymsWithAI(term.term, term.context, domain);

      if (synonyms.length > 0) {
        await supabase.from('learned_synonyms').upsert({
          instructor_course_id: courseId,
          canonical_term: term.term.toLowerCase(),
          synonyms,
          domain,
          confidence: 0.8,
          created_at: new Date().toISOString(),
        }, {
          onConflict: 'instructor_course_id,canonical_term',
        });
      }
    } catch (e) {
      console.log(`[DYNAMIC-TERMS] Failed to learn synonyms for "${term.term}": ${e}`);
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }
}

/**
 * Get dynamic synonyms for a search concept (course-aware)
 * @param concept - The search concept
 * @param courseId - Optional instructor_course_id for course-specific synonyms
 */
export async function getDynamicSynonyms(
  concept: string,
  courseId?: string
): Promise<string[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const lowerConcept = concept.toLowerCase();
  const synonyms: string[] = [];

  // Build query
  let query = supabase
    .from('learned_synonyms')
    .select('canonical_term, synonyms')
    .or(`canonical_term.ilike.%${lowerConcept}%`);

  // If we have a course ID, prioritize its synonyms
  if (courseId) {
    const { data } = await supabase
      .from('learned_synonyms')
      .select('canonical_term, synonyms')
      .eq('instructor_course_id', courseId);

    if (data) {
      for (const row of data) {
        if (lowerConcept.includes(row.canonical_term) ||
            row.synonyms.some((s: string) => lowerConcept.includes(s.toLowerCase()))) {
          synonyms.push(row.canonical_term, ...row.synonyms);
        }
      }
    }
  }

  // Also check domain-level synonyms
  const { data: domainData } = await query;
  if (domainData) {
    for (const row of domainData) {
      if (lowerConcept.includes(row.canonical_term) ||
          row.synonyms.some((s: string) => lowerConcept.includes(s.toLowerCase()))) {
        synonyms.push(row.canonical_term, ...row.synonyms);
      }
    }
  }

  return [...new Set(synonyms)];
}

/**
 * Dynamic query normalization based on detected domain
 */
export function normalizeQueryDynamic(
  query: string,
  domain?: string
): string {
  let normalized = query.toLowerCase();

  // Universal normalization (applies to all domains)
  const universalPatterns = [
    /\s+/g,                    // Multiple spaces
    /[^\w\s-]/g,              // Special characters except hyphen
  ];

  for (const pattern of universalPatterns) {
    normalized = normalized.replace(pattern, ' ');
  }

  // Domain-specific prefix/suffix removal
  // These are common educational prefixes that add noise
  const educationalPrefixes = [
    'introduction to', 'intro to', 'fundamentals of', 'basics of',
    'overview of', 'principles of', 'concepts of', 'theory of',
    'advanced', 'intermediate', 'beginner', 'basic',
  ];

  const educationalSuffixes = [
    'tutorial', 'guide', 'course', 'lecture', 'explained',
    'for beginners', 'for students', 'introduction', 'overview',
  ];

  for (const prefix of educationalPrefixes) {
    if (normalized.startsWith(prefix + ' ')) {
      normalized = normalized.slice(prefix.length + 1);
    }
  }

  for (const suffix of educationalSuffixes) {
    if (normalized.endsWith(' ' + suffix)) {
      normalized = normalized.slice(0, -(suffix.length + 1));
    }
  }

  return normalized.trim();
}

/**
 * Calculate semantic similarity with dynamic thresholds
 * Threshold adapts based on query complexity
 */
export function calculateDynamicSimilarity(
  keywords1: string[],
  keywords2: string[],
  synonymMap?: Map<string, string[]>
): { overlap: number; threshold: number; isMatch: boolean } {
  if (keywords1.length === 0 || keywords2.length === 0) {
    return { overlap: 0, threshold: 0.5, isMatch: false };
  }

  const set1 = new Set(keywords1.map(k => k.toLowerCase()));
  const set2 = new Set(keywords2.map(k => k.toLowerCase()));

  let matches = 0;

  // Direct matches
  for (const word of set1) {
    if (set2.has(word)) {
      matches++;
      continue;
    }

    // Check synonyms
    if (synonymMap) {
      const syns = synonymMap.get(word);
      if (syns?.some(s => set2.has(s.toLowerCase()))) {
        matches += 0.8; // Synonym match counts as 80%
      }
    }
  }

  const union = new Set([...set1, ...set2]);
  const overlap = matches / union.size;

  // Dynamic threshold based on query complexity
  // Shorter queries need higher overlap for confidence
  // Longer queries can tolerate lower overlap
  const avgLength = (keywords1.length + keywords2.length) / 2;
  let threshold: number;

  if (avgLength <= 3) {
    threshold = 0.7; // Short queries: need 70% match
  } else if (avgLength <= 6) {
    threshold = 0.6; // Medium queries: need 60% match
  } else {
    threshold = 0.5; // Long queries: need 50% match
  }

  return {
    overlap,
    threshold,
    isMatch: overlap >= threshold,
  };
}

/**
 * Store extracted terms for a course
 * @param courseId - The instructor_course_id
 * @param terms - Extracted terms from the syllabus
 * @param domain - Detected academic domain
 */
export async function storeExtractedTerms(
  courseId: string,
  terms: ExtractedTerm[],
  domain: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Store domain detection result
  await supabase
    .from('instructor_courses')
    .update({ detected_domain: domain })
    .eq('id', courseId);

  // Store extracted terms
  const termRecords = terms.slice(0, 50).map(t => ({
    instructor_course_id: courseId,
    term: t.term,
    frequency: t.frequency,
    domain,
  }));

  await supabase
    .from('course_terms')
    .upsert(termRecords, { onConflict: 'instructor_course_id,term' });
}
