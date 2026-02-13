
import { compareProviders, webSearch, webScrape } from "../_shared/web-provider.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";

/**
 * Compare Firecrawl and Jina AI providers
 *
 * This endpoint allows you to test both providers with the same query
 * and compare their results, speed, and reliability.
 *
 * Usage:
 *   POST /compare-web-providers
 *   {
 *     "mode": "search" | "scrape",
 *     "query": "python course site:coursera.org",  // for search
 *     "url": "https://example.com",                // for scrape
 *     "limit": 5
 *   }
 */
Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { mode, query, url, limit = 5 } = await req.json();

    if (mode === "search") {
      if (!query) {
        return createErrorResponse('BAD_REQUEST', corsHeaders, 'query is required for search mode');
      }

      console.log(`Comparing providers for search: "${query}"`);

      // Compare both providers
      const comparison = await compareProviders(query, { limit });

      return new Response(
        JSON.stringify({
          success: true,
          mode: "search",
          query,
          ...comparison,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mode === "scrape") {
      if (!url) {
        return createErrorResponse('BAD_REQUEST', corsHeaders, 'url is required for scrape mode');
      }

      console.log(`Comparing providers for scrape: "${url}"`);

      // Test Firecrawl
      const firecrawlStart = Date.now();
      let firecrawlResult: any = null;
      let firecrawlError: string | undefined;

      try {
        firecrawlResult = await webScrape(url, { provider: 'firecrawl' });
      } catch (e) {
        firecrawlError = e instanceof Error ? e.message : "Unknown error";
      }
      const firecrawlDuration = Date.now() - firecrawlStart;

      // Test Jina
      const jinaStart = Date.now();
      let jinaResult: any = null;
      let jinaError: string | undefined;

      try {
        jinaResult = await webScrape(url, { provider: 'jina' });
      } catch (e) {
        jinaError = e instanceof Error ? e.message : "Unknown error";
      }
      const jinaDuration = Date.now() - jinaStart;

      // Compare content lengths
      const firecrawlLength = firecrawlResult?.markdown?.length || 0;
      const jinaLength = jinaResult?.markdown?.length || 0;

      let recommendation = "";
      if (firecrawlError && !jinaError) {
        recommendation = "Jina succeeded, Firecrawl failed - Jina is better for this URL";
      } else if (!firecrawlError && jinaError) {
        recommendation = "Firecrawl succeeded, Jina failed - keep using Firecrawl";
      } else if (firecrawlError && jinaError) {
        recommendation = "Both failed - URL may be protected or invalid";
      } else {
        const lengthDiff = Math.abs(firecrawlLength - jinaLength) / Math.max(firecrawlLength, jinaLength, 1);
        if (lengthDiff < 0.2) {
          recommendation = `Content similar (${Math.round((1-lengthDiff) * 100)}% match) - Jina is viable`;
        } else {
          recommendation = `Content differs significantly - compare quality manually`;
        }

        if (jinaDuration < firecrawlDuration * 0.8) {
          recommendation += ` | Jina is ${Math.round((1 - jinaDuration/firecrawlDuration) * 100)}% faster`;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          mode: "scrape",
          url,
          firecrawl: {
            success: firecrawlResult?.success || false,
            error: firecrawlError,
            duration: firecrawlDuration,
            contentLength: firecrawlLength,
            preview: firecrawlResult?.markdown?.slice(0, 500),
          },
          jina: {
            success: jinaResult?.success || false,
            error: jinaError,
            duration: jinaDuration,
            contentLength: jinaLength,
            preview: jinaResult?.markdown?.slice(0, 500),
          },
          comparison: {
            firecrawlLength,
            jinaLength,
            recommendation,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return createErrorResponse('BAD_REQUEST', corsHeaders, "mode must be 'search' or 'scrape'");
  } catch (error) {
    logError('compare-web-providers', error);
    return createErrorResponse('INTERNAL_ERROR', corsHeaders, error instanceof Error ? error.message : 'Unknown error');
  }
});
