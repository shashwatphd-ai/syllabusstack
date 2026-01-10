import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { compareProviders, webSearch, webScrape } from "../_shared/web-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode, query, url, limit = 5 } = await req.json();

    if (mode === "search") {
      if (!query) {
        return new Response(
          JSON.stringify({ error: "query is required for search mode" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
        return new Response(
          JSON.stringify({ error: "url is required for scrape mode" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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

    return new Response(
      JSON.stringify({ error: "mode must be 'search' or 'scrape'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in compare-web-providers:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
