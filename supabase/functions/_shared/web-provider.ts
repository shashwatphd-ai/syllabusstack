/**
 * Web Provider Abstraction Layer
 *
 * Allows switching between Firecrawl and Jina AI for web search and scraping.
 * Both providers return the same normalized format for easy comparison and switching.
 *
 * Usage:
 *   const provider = getWebProvider(); // Uses WEB_PROVIDER env var or defaults to 'firecrawl'
 *   const results = await provider.search(query, { limit: 5 });
 *   const content = await provider.scrape(url);
 */

// ============================================================================
// Types
// ============================================================================

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  markdown: string;  // Full page content in markdown
}

export interface SearchOptions {
  limit?: number;
  formats?: string[];
}

export interface ScrapeResult {
  success: boolean;
  markdown: string;
  metadata: {
    title?: string;
    description?: string;
    sourceURL?: string;
  };
}

export interface ScrapeOptions {
  formats?: string[];
  onlyMainContent?: boolean;
  waitFor?: number;
}

export interface WebProvider {
  name: string;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  scrape(url: string, options?: ScrapeOptions): Promise<ScrapeResult>;
}

// ============================================================================
// Firecrawl Provider
// ============================================================================

class FirecrawlProvider implements WebProvider {
  name = 'firecrawl';
  private apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get("FIRECRAWL_API_KEY") || "";
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.apiKey) {
      throw new Error("FIRECRAWL_API_KEY not configured");
    }

    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: options.limit || 5,
        scrapeOptions: {
          formats: options.formats || ["markdown"],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl search error: ${response.status}`, errorText);
      throw new Error(`Firecrawl search failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      return [];
    }

    return data.data.map((result: any) => ({
      title: result.title || "",
      url: result.url || "",
      description: result.description || "",
      markdown: result.markdown || result.content || "",
    }));
  }

  async scrape(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
    if (!this.apiKey) {
      throw new Error("FIRECRAWL_API_KEY not configured");
    }

    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: options.formats || ["markdown"],
        onlyMainContent: options.onlyMainContent ?? true,
        waitFor: options.waitFor || 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl scrape error: ${response.status}`, errorText);
      return {
        success: false,
        markdown: "",
        metadata: {},
      };
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      return {
        success: false,
        markdown: "",
        metadata: {},
      };
    }

    return {
      success: true,
      markdown: data.data.markdown || "",
      metadata: data.data.metadata || {},
    };
  }
}

// ============================================================================
// Jina AI Provider
// ============================================================================

class JinaProvider implements WebProvider {
  name = 'jina';
  private apiKey: string;

  constructor() {
    // Jina works without API key (rate limited) or with API key (higher limits)
    this.apiKey = Deno.env.get("JINA_API_KEY") || "";
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const encodedQuery = encodeURIComponent(query);
    const limit = options.limit || 5;

    const headers: Record<string, string> = {
      "Accept": "application/json",
    };

    // Add API key if available for higher rate limits
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(`https://s.jina.ai/?q=${encodedQuery}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Jina search error: ${response.status}`, errorText);
        throw new Error(`Jina search failed: ${response.status}`);
      }

      const data = await response.json();

      // Jina returns { data: [...] } with up to 5 results
      const results = data.data || [];

      return results.slice(0, limit).map((result: any) => ({
        title: result.title || "",
        url: result.url || "",
        description: this.extractDescription(result.content || ""),
        markdown: result.content || "",
      }));
    } catch (error) {
      console.error("Jina search error:", error);
      throw error;
    }
  }

  async scrape(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };

    // Add API key if available
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    // Jina options via headers
    if (options.onlyMainContent !== false) {
      headers["X-Return-Format"] = "markdown";
    }

    try {
      const response = await fetch(`https://r.jina.ai/${url}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Jina scrape error: ${response.status}`, errorText);
        return {
          success: false,
          markdown: "",
          metadata: {},
        };
      }

      const data = await response.json();

      return {
        success: true,
        markdown: data.data?.content || data.content || "",
        metadata: {
          title: data.data?.title || data.title || "",
          description: data.data?.description || "",
          sourceURL: data.data?.url || url,
        },
      };
    } catch (error) {
      console.error("Jina scrape error:", error);
      return {
        success: false,
        markdown: "",
        metadata: {},
      };
    }
  }

  private extractDescription(content: string): string {
    if (!content) return "";
    // Get first meaningful paragraph (>50 chars)
    const lines = content.split("\n").filter(l => l.trim().length > 50);
    return lines[0]?.slice(0, 300) || "";
  }
}

// ============================================================================
// Provider Factory
// ============================================================================

let cachedProvider: WebProvider | null = null;

/**
 * Get the web provider based on environment configuration.
 *
 * Set WEB_PROVIDER env var to switch:
 *   - 'firecrawl' (default) - Uses Firecrawl API
 *   - 'jina' - Uses Jina AI (free, rate limited without API key)
 *
 * @param forceProvider - Override env var to use specific provider
 */
export function getWebProvider(forceProvider?: 'firecrawl' | 'jina'): WebProvider {
  const providerName = forceProvider || Deno.env.get("WEB_PROVIDER") || "firecrawl";

  // Return cached provider if same type
  if (cachedProvider && cachedProvider.name === providerName) {
    return cachedProvider;
  }

  switch (providerName.toLowerCase()) {
    case 'jina':
      cachedProvider = new JinaProvider();
      break;
    case 'firecrawl':
    default:
      cachedProvider = new FirecrawlProvider();
      break;
  }

  console.log(`Web provider initialized: ${cachedProvider.name}`);
  return cachedProvider;
}

/**
 * Search the web using configured provider.
 * Convenience function that handles provider selection.
 */
export async function webSearch(
  query: string,
  options?: SearchOptions & { provider?: 'firecrawl' | 'jina' }
): Promise<SearchResult[]> {
  const provider = getWebProvider(options?.provider);
  return provider.search(query, options);
}

/**
 * Scrape a URL using configured provider.
 * Convenience function that handles provider selection.
 */
export async function webScrape(
  url: string,
  options?: ScrapeOptions & { provider?: 'firecrawl' | 'jina' }
): Promise<ScrapeResult> {
  const provider = getWebProvider(options?.provider);
  return provider.scrape(url, options);
}

/**
 * Test both providers with the same query and compare results.
 * Useful for A/B testing during migration.
 */
export async function compareProviders(
  query: string,
  options?: SearchOptions
): Promise<{
  firecrawl: { results: SearchResult[]; error?: string; duration: number };
  jina: { results: SearchResult[]; error?: string; duration: number };
  comparison: {
    firecrawlCount: number;
    jinaCount: number;
    urlOverlap: string[];
    recommendation: string;
  };
}> {
  const firecrawlStart = Date.now();
  let firecrawlResults: SearchResult[] = [];
  let firecrawlError: string | undefined;

  try {
    const firecrawl = new FirecrawlProvider();
    firecrawlResults = await firecrawl.search(query, options);
  } catch (e) {
    firecrawlError = e instanceof Error ? e.message : "Unknown error";
  }
  const firecrawlDuration = Date.now() - firecrawlStart;

  const jinaStart = Date.now();
  let jinaResults: SearchResult[] = [];
  let jinaError: string | undefined;

  try {
    const jina = new JinaProvider();
    jinaResults = await jina.search(query, options);
  } catch (e) {
    jinaError = e instanceof Error ? e.message : "Unknown error";
  }
  const jinaDuration = Date.now() - jinaStart;

  // Find URL overlap
  const firecrawlUrls = new Set(firecrawlResults.map(r => r.url));
  const jinaUrls = new Set(jinaResults.map(r => r.url));
  const urlOverlap = [...firecrawlUrls].filter(url => jinaUrls.has(url));

  // Generate recommendation
  let recommendation = "";
  if (firecrawlError && !jinaError) {
    recommendation = "Jina is working, Firecrawl failed - consider switching to Jina";
  } else if (!firecrawlError && jinaError) {
    recommendation = "Firecrawl is working, Jina failed - keep using Firecrawl";
  } else if (firecrawlError && jinaError) {
    recommendation = "Both providers failed - check API keys and network";
  } else {
    const overlap = urlOverlap.length / Math.max(firecrawlResults.length, jinaResults.length, 1);
    if (overlap > 0.6) {
      recommendation = `Results are similar (${Math.round(overlap * 100)}% overlap) - Jina is viable replacement`;
    } else {
      recommendation = `Results differ (${Math.round(overlap * 100)}% overlap) - test more queries before switching`;
    }

    if (jinaDuration < firecrawlDuration * 0.8) {
      recommendation += ` | Jina is ${Math.round((1 - jinaDuration/firecrawlDuration) * 100)}% faster`;
    }
  }

  return {
    firecrawl: {
      results: firecrawlResults,
      error: firecrawlError,
      duration: firecrawlDuration,
    },
    jina: {
      results: jinaResults,
      error: jinaError,
      duration: jinaDuration,
    },
    comparison: {
      firecrawlCount: firecrawlResults.length,
      jinaCount: jinaResults.length,
      urlOverlap,
      recommendation,
    },
  };
}
