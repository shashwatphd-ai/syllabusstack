/**
 * Concept Extractor
 *
 * Single Responsibility: Extract searchable concepts from learning objective text
 *
 * This extractor analyzes the LO text to find:
 * - Primary concept (main topic)
 * - Secondary concepts (supporting topics)
 * - N-grams (multi-word phrases)
 * - Implied concepts (from context)
 *
 * ALL TERMS ARE DERIVED FROM THE SYLLABUS - NOTHING IS HARDCODED
 */

import {
  IConceptExtractor,
  ExtractedConcepts,
  QueryGenerationContext,
} from '../types.ts';

/**
 * Stop words to filter out (common words that don't help search)
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
  'we', 'they', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when',
  'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then',
  'student', 'students', 'able', 'ability', 'demonstrate', 'understand',
  'learn', 'learning', 'course', 'class', 'module', 'week', 'unit',
]);

/**
 * Bloom's action verbs (to identify the action context)
 */
const BLOOM_VERBS: Record<string, string[]> = {
  remember: ['define', 'list', 'recall', 'identify', 'name', 'recognize', 'describe', 'state'],
  understand: ['explain', 'summarize', 'interpret', 'classify', 'compare', 'contrast', 'discuss'],
  apply: ['apply', 'use', 'implement', 'execute', 'solve', 'demonstrate', 'calculate', 'compute'],
  analyze: ['analyze', 'differentiate', 'examine', 'compare', 'contrast', 'investigate', 'categorize'],
  evaluate: ['evaluate', 'assess', 'judge', 'justify', 'critique', 'defend', 'argue', 'support'],
  create: ['create', 'design', 'develop', 'construct', 'produce', 'formulate', 'propose', 'plan'],
};

/**
 * Default concept extractor implementation
 */
export class ConceptExtractor implements IConceptExtractor {
  /**
   * Extract concepts from learning objective text
   * All extraction is based on the actual syllabus content
   */
  extract(text: string, context?: QueryGenerationContext): ExtractedConcepts {
    const normalizedText = text.toLowerCase();
    const words = this.tokenize(text);
    const cleanWords = this.removeStopWords(words);

    // Extract n-grams (2-4 word phrases) from the actual text
    const nGrams = this.extractNGrams(text, 2, 4);

    // Find the action verb (determines what student should do)
    const actionContext = this.findActionVerb(normalizedText);

    // Primary concept is the core_concept from syllabus extraction
    // If not available, derive from text
    const primaryConcept = context?.learningObjective.core_concept ||
      this.derivePrimaryConcept(cleanWords, nGrams);

    // Secondary concepts from the remaining significant terms
    const secondaryConcepts = this.deriveSecondaryConcepts(
      cleanWords,
      nGrams,
      primaryConcept
    );

    // Implied concepts from module and course context
    const impliedConcepts = this.deriveImpliedConcepts(context);

    return {
      primaryConcept,
      secondaryConcepts,
      actionContext,
      impliedConcepts,
      nGrams,
    };
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')  // Keep hyphens for compound words
      .split(/\s+/)
      .filter(word => word.length > 1);
  }

  /**
   * Remove stop words while preserving important terms
   */
  private removeStopWords(words: string[]): string[] {
    return words.filter(word => !STOP_WORDS.has(word) && word.length > 2);
  }

  /**
   * Extract n-grams (multi-word phrases) from text
   * These are the most valuable for search queries
   */
  private extractNGrams(text: string, minN: number, maxN: number): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);

    const nGrams: string[] = [];
    const seen = new Set<string>();

    for (let n = maxN; n >= minN; n--) {
      for (let i = 0; i <= words.length - n; i++) {
        const phrase = words.slice(i, i + n).join(' ');

        // Skip if contains too many stop words
        const phraseWords = phrase.split(' ');
        const nonStopWords = phraseWords.filter(w => !STOP_WORDS.has(w));

        if (nonStopWords.length >= Math.ceil(n / 2) && !seen.has(phrase)) {
          // Skip if this phrase is a subset of an already found phrase
          const isSubset = nGrams.some(existing => existing.includes(phrase));
          if (!isSubset) {
            nGrams.push(phrase);
            seen.add(phrase);
          }
        }
      }
    }

    // Sort by length (longer phrases are more specific)
    return nGrams
      .sort((a, b) => b.split(' ').length - a.split(' ').length)
      .slice(0, 10);
  }

  /**
   * Find the action verb (Bloom's taxonomy) in the text
   */
  private findActionVerb(text: string): string {
    for (const [level, verbs] of Object.entries(BLOOM_VERBS)) {
      for (const verb of verbs) {
        if (text.includes(verb)) {
          return verb;
        }
      }
    }
    return 'understand'; // Default action
  }

  /**
   * Derive the primary concept from words and n-grams
   * Prefers longer, more specific phrases
   */
  private derivePrimaryConcept(words: string[], nGrams: string[]): string {
    // Prefer 2-3 word n-grams as primary concept
    const bestNGram = nGrams.find(ng => {
      const wordCount = ng.split(' ').length;
      return wordCount >= 2 && wordCount <= 4;
    });

    if (bestNGram) {
      return bestNGram;
    }

    // Fallback to first 2-3 significant words
    return words.slice(0, 3).join(' ');
  }

  /**
   * Derive secondary concepts from remaining terms
   */
  private deriveSecondaryConcepts(
    words: string[],
    nGrams: string[],
    primaryConcept: string
  ): string[] {
    const primaryWords = new Set(primaryConcept.toLowerCase().split(' '));
    const secondary: string[] = [];

    // Add n-grams that don't overlap with primary
    for (const ng of nGrams) {
      const ngWords = ng.split(' ');
      const overlap = ngWords.filter(w => primaryWords.has(w)).length;
      if (overlap < ngWords.length / 2) {
        secondary.push(ng);
      }
    }

    // Add remaining significant single words
    for (const word of words) {
      if (!primaryWords.has(word) && word.length > 4) {
        secondary.push(word);
      }
    }

    return [...new Set(secondary)].slice(0, 5);
  }

  /**
   * Derive implied concepts from module and course context
   * These are additional search terms from the syllabus structure
   */
  private deriveImpliedConcepts(context?: QueryGenerationContext): string[] {
    const implied: string[] = [];

    if (!context) return implied;

    // Extract keywords from module title
    if (context.module?.title) {
      const moduleWords = this.extractNGrams(context.module.title, 2, 3);
      implied.push(...moduleWords.slice(0, 3));
    }

    // Extract keywords from module description
    if (context.module?.description) {
      const descWords = this.extractNGrams(context.module.description, 2, 3);
      implied.push(...descWords.slice(0, 2));
    }

    // Extract keywords from course title
    if (context.course?.title) {
      const courseWords = this.extractNGrams(context.course.title, 2, 3);
      implied.push(...courseWords.slice(0, 2));
    }

    return [...new Set(implied)].slice(0, 5);
  }
}

/**
 * Module context extractor - extracts terms from module/course context
 */
export class ModuleContextExtractor {
  /**
   * Extract searchable terms from module title and description
   */
  extractFromModule(module: { title: string; description?: string }): string[] {
    const terms: string[] = [];
    const conceptExtractor = new ConceptExtractor();

    // Extract from title
    if (module.title) {
      // Remove week/unit numbers
      const cleanTitle = module.title
        .replace(/^(week|unit|module|chapter)\s*\d+[:\s]*/i, '')
        .trim();

      if (cleanTitle) {
        const concepts = conceptExtractor.extract(cleanTitle);
        terms.push(concepts.primaryConcept);
        terms.push(...concepts.secondaryConcepts.slice(0, 2));
      }
    }

    // Extract from description
    if (module.description) {
      const concepts = conceptExtractor.extract(module.description);
      terms.push(...concepts.nGrams.slice(0, 3));
    }

    return [...new Set(terms)].filter(t => t.length > 0);
  }

  /**
   * Extract searchable terms from course title
   */
  extractFromCourse(course: { title: string; description?: string; code?: string }): string[] {
    const terms: string[] = [];
    const conceptExtractor = new ConceptExtractor();

    if (course.title) {
      // Remove course code from title
      const cleanTitle = course.title
        .replace(/^[A-Z]{2,4}\s*\d{3,4}[:\s-]*/i, '')
        .trim();

      if (cleanTitle) {
        const concepts = conceptExtractor.extract(cleanTitle);
        terms.push(concepts.primaryConcept);
      }
    }

    return [...new Set(terms)].filter(t => t.length > 0);
  }
}

// Export singleton instances
export const conceptExtractor = new ConceptExtractor();
export const moduleContextExtractor = new ModuleContextExtractor();
