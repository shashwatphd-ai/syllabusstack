/**
 * Term Expanders - Base Classes and Implementations
 *
 * Open/Closed Principle: New expanders can be added without modifying existing code
 *
 * These expanders take terms FROM THE SYLLABUS and expand them with:
 * - Academic synonyms
 * - Phrasing variations
 * - Related terms
 *
 * The original terms ALWAYS come from the syllabus - expanders only ENRICH them
 */

import { ITermExpander, ExpandedTerms, Domain } from '../types.ts';

/**
 * Abstract base class for term expanders
 * Provides common functionality for all expanders
 */
export abstract class BaseTermExpander implements ITermExpander {
  abstract readonly name: string;

  abstract expand(term: string, domain: Domain): Promise<ExpandedTerms>;

  abstract isAvailable(): Promise<boolean>;

  /**
   * Helper: Create an empty expansion result
   */
  protected emptyExpansion(term: string): ExpandedTerms {
    return {
      original: term,
      synonyms: [],
      variations: [],
      relatedTerms: [],
    };
  }

  /**
   * Helper: Deduplicate and clean terms
   */
  protected cleanTerms(terms: string[], original: string): string[] {
    const originalLower = original.toLowerCase();
    return [...new Set(terms)]
      .map(t => t.trim().toLowerCase())
      .filter(t =>
        t.length > 2 &&
        t !== originalLower &&
        !t.includes(originalLower) &&
        !originalLower.includes(t)
      )
      .slice(0, 5);
  }
}

/**
 * Rule-Based Expander
 *
 * Uses pattern matching to generate variations of syllabus terms.
 * NO HARDCODED DOMAIN TERMS - only patterns applied to YOUR terms.
 */
export class RuleBasedExpander extends BaseTermExpander {
  readonly name = 'rule_based';

  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }

  async expand(term: string, domain: Domain): Promise<ExpandedTerms> {
    const result: ExpandedTerms = {
      original: term,
      synonyms: [],
      variations: [],
      relatedTerms: [],
    };

    // Generate phrasing variations of the syllabus term
    result.variations = this.generateVariations(term);

    // Generate academic rephrasing
    result.synonyms = this.generateAcademicRephrasing(term, domain);

    return result;
  }

  /**
   * Generate different phrasings of the same term
   * These are patterns applied to YOUR syllabus term
   */
  private generateVariations(term: string): string[] {
    const variations: string[] = [];
    const words = term.split(' ');

    // Reorder multi-word terms
    if (words.length >= 2) {
      // "cash flow management" → "management of cash flow"
      variations.push(`${words[words.length - 1]} of ${words.slice(0, -1).join(' ')}`);

      // "cash flow management" → "managing cash flow"
      if (words[words.length - 1].endsWith('ment')) {
        const verb = words[words.length - 1].replace('ment', 'ing');
        variations.push(`${verb} ${words.slice(0, -1).join(' ')}`);
      }

      // "cash flow management" → "cash flow" (shorter version)
      if (words.length > 2) {
        variations.push(words.slice(0, 2).join(' '));
      }
    }

    // Add common educational suffixes
    variations.push(`${term} basics`);
    variations.push(`${term} fundamentals`);
    variations.push(`${term} concepts`);

    return this.cleanTerms(variations, term);
  }

  /**
   * Generate academic rephrasing based on common patterns
   * Applied to YOUR syllabus term, not replacing it
   */
  private generateAcademicRephrasing(term: string, domain: Domain): string[] {
    const rephrasing: string[] = [];
    const words = term.toLowerCase().split(' ');

    // Common academic term transformations (patterns, not hardcoded terms)
    const patterns: Record<string, string[]> = {
      'analysis': ['examination', 'assessment', 'evaluation'],
      'management': ['administration', 'governance', 'oversight'],
      'development': ['evolution', 'growth', 'progression'],
      'strategy': ['approach', 'methodology', 'framework'],
      'system': ['framework', 'structure', 'mechanism'],
      'process': ['procedure', 'method', 'workflow'],
      'model': ['framework', 'paradigm', 'approach'],
      'theory': ['concept', 'principle', 'framework'],
      'method': ['technique', 'approach', 'procedure'],
      'function': ['role', 'purpose', 'operation'],
    };

    // Apply pattern replacements to YOUR term
    for (const [pattern, replacements] of Object.entries(patterns)) {
      if (term.toLowerCase().includes(pattern)) {
        for (const replacement of replacements) {
          const newTerm = term.toLowerCase().replace(pattern, replacement);
          if (newTerm !== term.toLowerCase()) {
            rephrasing.push(newTerm);
          }
        }
      }
    }

    return this.cleanTerms(rephrasing, term);
  }
}

/**
 * Open LLM Expander
 *
 * Uses free/cheap LLM APIs (Groq, Together AI) to expand terms.
 * Follows Open/Closed - can swap LLM providers without changing interface.
 */
export class OpenLLMExpander extends BaseTermExpander {
  readonly name = 'open_llm';

  private readonly providers = [
    { name: 'groq', endpoint: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.1-70b-versatile' },
    { name: 'together', endpoint: 'https://api.together.xyz/v1/chat/completions', model: 'mistralai/Mistral-7B-Instruct-v0.2' },
  ];

  async isAvailable(): Promise<boolean> {
    const groqKey = Deno.env.get('GROQ_API_KEY');
    const togetherKey = Deno.env.get('TOGETHER_API_KEY');
    return !!(groqKey || togetherKey);
  }

  async expand(term: string, domain: Domain): Promise<ExpandedTerms> {
    const result = this.emptyExpansion(term);

    // Try each provider in order
    for (const provider of this.providers) {
      const apiKey = provider.name === 'groq'
        ? Deno.env.get('GROQ_API_KEY')
        : Deno.env.get('TOGETHER_API_KEY');

      if (!apiKey) continue;

      try {
        const expanded = await this.callLLM(provider, apiKey, term, domain);
        if (expanded.synonyms.length > 0) {
          return expanded;
        }
      } catch (e) {
        console.log(`${provider.name} expansion failed:`, e);
        continue;
      }
    }

    return result;
  }

  private async callLLM(
    provider: { endpoint: string; model: string },
    apiKey: string,
    term: string,
    domain: Domain
  ): Promise<ExpandedTerms> {
    const result = this.emptyExpansion(term);

    // Very focused prompt - just synonym expansion
    const prompt = `For the ${domain} term "${term}", list 3-5 academic synonyms or alternative phrasings that would be used in educational content.

Return ONLY a JSON array of strings, nothing else. Example: ["term1", "term2", "term3"]`;

    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON array from response
    try {
      const match = content.match(/\[.*\]/s);
      if (match) {
        const synonyms = JSON.parse(match[0]);
        if (Array.isArray(synonyms)) {
          result.synonyms = this.cleanTerms(
            synonyms.filter((s: unknown) => typeof s === 'string'),
            term
          );
        }
      }
    } catch {
      // JSON parse failed, ignore
    }

    return result;
  }
}

/**
 * Composite Expander
 *
 * Combines multiple expanders with fallback logic.
 * Liskov Substitution: Can be used anywhere ITermExpander is expected.
 */
export class CompositeExpander extends BaseTermExpander {
  readonly name = 'composite';

  private expanders: ITermExpander[];

  constructor(expanders: ITermExpander[]) {
    super();
    this.expanders = expanders;
  }

  async isAvailable(): Promise<boolean> {
    for (const expander of this.expanders) {
      if (await expander.isAvailable()) {
        return true;
      }
    }
    return false;
  }

  async expand(term: string, domain: Domain): Promise<ExpandedTerms> {
    const result: ExpandedTerms = {
      original: term,
      synonyms: [],
      variations: [],
      relatedTerms: [],
    };

    // Collect from all available expanders
    for (const expander of this.expanders) {
      try {
        if (await expander.isAvailable()) {
          const expansion = await expander.expand(term, domain);
          result.synonyms.push(...expansion.synonyms);
          result.variations.push(...expansion.variations);
          result.relatedTerms.push(...expansion.relatedTerms);
        }
      } catch (e) {
        console.log(`Expander ${expander.name} failed:`, e);
        continue;
      }
    }

    // Deduplicate
    result.synonyms = [...new Set(result.synonyms)].slice(0, 5);
    result.variations = [...new Set(result.variations)].slice(0, 5);
    result.relatedTerms = [...new Set(result.relatedTerms)].slice(0, 5);

    return result;
  }
}

// Export factory function for default expander setup
export function createDefaultExpander(): ITermExpander {
  return new CompositeExpander([
    new RuleBasedExpander(),   // Always available, fast
    new OpenLLMExpander(),     // Optional enhancement
  ]);
}
