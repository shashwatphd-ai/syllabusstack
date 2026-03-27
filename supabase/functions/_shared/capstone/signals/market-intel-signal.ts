/**
 * Signal 2: Market Intelligence
 * Scores companies based on funding stage, total funding, hiring velocity,
 * and buying intent signals already captured during enrichment.
 *
 * Enhanced with live Apollo News API integration for real-time market signals.
 */

import type { SignalResult, SignalProvider, SignalContext, SignalName } from '../signal-types.ts';
import { withApolloCircuit } from '../circuit-breaker.ts';

// =============================================================================
// APOLLO NEWS INTEGRATION
// =============================================================================

async function fetchApolloNews(orgId: string, apolloApiKey: string): Promise<any[]> {
  if (!orgId || !apolloApiKey) return [];

  try {
    const response = await withApolloCircuit(() =>
      fetch(`https://api.apollo.io/v1/organizations/${orgId}/news`, {
        headers: {
          'X-Api-Key': apolloApiKey,
          'Content-Type': 'application/json',
        },
      }).then(res => res.json())
    );
    return response.data?.news || response.news || [];
  } catch (error) {
    console.warn(`  ⚠️ [Signal 2] Apollo News API error: ${error}`);
    return [];
  }
}

function scoreNewsSignals(news: any[]): { score: number; signals: string[] } {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const recentNews = news.filter(item => {
    const publishedAt = item.published_at || item.date;
    return publishedAt ? new Date(publishedAt).getTime() >= cutoff : false;
  });

  const signals: string[] = [];

  // Category definitions with weights
  const categories: { name: string; keywords: string[]; weight: number }[] = [
    { name: 'funding', keywords: ['funding', 'raised', 'investment', 'round'], weight: 0.20 },
    { name: 'hiring', keywords: ['hiring', 'hires', 'appointed', 'joined'], weight: 0.15 },
    { name: 'expansion', keywords: ['expansion', 'opens', 'new office', 'headquarter'], weight: 0.12 },
    { name: 'contract', keywords: ['contract', 'partnership', 'deal', 'awarded'], weight: 0.10 },
    { name: 'launch', keywords: ['launch', 'release', 'announced', 'product'], weight: 0.08 },
  ];

  let score = 0;

  for (const category of categories) {
    const hits = recentNews.filter(item => {
      const text = ((item.title || '') + ' ' + (item.snippet || '')).toLowerCase();
      return category.keywords.some(kw => text.includes(kw));
    });
    if (hits.length > 0) {
      score += category.weight * 100;
      signals.push(`${category.name}: ${hits.length} recent article(s) detected`);
    }
  }

  // Volume score (weight 0.15)
  const volumeScore = Math.min(15, recentNews.length * 3);
  score += volumeScore;

  // Recency score (weight 0.20)
  if (recentNews.length > 0) {
    const newestDate = Math.max(
      ...recentNews.map(item => new Date(item.published_at || item.date || 0).getTime())
    );
    const newestAgeDays = (Date.now() - newestDate) / (24 * 60 * 60 * 1000);
    const recencyScore = Math.max(0, 20 - (newestAgeDays / 90 * 20));
    score += recencyScore;
  }

  score = Math.min(100, score);

  return { score, signals };
}

// =============================================================================
// SIGNAL PROVIDER
// =============================================================================

export const MarketIntelSignal: SignalProvider = {
  name: 'market_intelligence' as SignalName,
  weight: 0.25,

  async calculate(context: SignalContext): Promise<SignalResult> {
    const { company, jobPostings } = context;
    const apolloApiKey = context.apolloApiKey;
    const orgId = company.apollo_organization_id;
    console.log(`  📰 [Signal 2] Market intelligence for ${company.name}`);

    let staticScore = 10; // Baseline
    const signals: string[] = [];

    // Funding analysis
    const fundingStage = company.funding_stage || '';
    const totalFunding = company.total_funding_usd || 0;

    if (fundingStage) {
      const stage = fundingStage.toLowerCase();
      if (stage.includes('series c') || stage.includes('series d') || stage.includes('series e')) {
        staticScore += 25;
        signals.push(`Late-stage funding (${fundingStage})`);
      } else if (stage.includes('series b')) {
        staticScore += 20;
        signals.push('Series B — growth stage');
      } else if (stage.includes('series a')) {
        staticScore += 15;
        signals.push('Series A funded');
      } else if (stage.includes('seed') || stage.includes('angel')) {
        staticScore += 10;
        signals.push('Early-stage funding');
      } else if (stage.includes('ipo') || stage.includes('public')) {
        staticScore += 18;
        signals.push('Publicly traded');
      } else if (stage.includes('private equity') || stage.includes('acquired')) {
        staticScore += 15;
        signals.push('PE-backed or acquired');
      }
    }

    if (totalFunding > 50_000_000) {
      staticScore += 10;
      signals.push(`$${(totalFunding / 1_000_000).toFixed(0)}M+ total funding`);
    } else if (totalFunding > 10_000_000) {
      staticScore += 5;
      signals.push(`$${(totalFunding / 1_000_000).toFixed(0)}M total funding`);
    }

    // Hiring velocity
    const jobs = jobPostings || [];
    const jobCount = Array.isArray(jobs) ? jobs.length : 0;
    if (jobCount > 10) {
      staticScore += 20;
      signals.push(`${jobCount}+ active postings — high hiring velocity`);
    } else if (jobCount > 5) {
      staticScore += 15;
      signals.push(`${jobCount} active postings — actively hiring`);
    } else if (jobCount > 0) {
      staticScore += 8;
      signals.push(`${jobCount} active postings`);
    }

    // Company size as growth proxy
    const sizeStr = company.size || '';
    const sizeNum = parseInt(sizeStr.replace(/[^0-9]/g, ''), 10) || 0;
    if (sizeNum > 500) {
      staticScore += 5;
    }

    staticScore = Math.min(100, staticScore);

    // Live news integration
    const newsItems = await fetchApolloNews(orgId || '', apolloApiKey || '');
    let finalScore: number;

    if (newsItems.length > 0) {
      const newsResult = scoreNewsSignals(newsItems);
      finalScore = Math.min(100, staticScore * 0.4 + newsResult.score * 0.6);
      signals.push(...newsResult.signals);
    } else {
      finalScore = staticScore;
    }

    const confidence = signals.length >= 3 ? 0.8 : signals.length >= 1 ? 0.5 : 0.2;

    if (signals.length === 0) signals.push('Limited market signals available');
    console.log(`     ✅ Score: ${finalScore}/100`);

    return { score: finalScore, confidence, signals, rawData: { fundingStage, totalFunding, jobCount, newsCount: newsItems.length } };
  },
};

export default MarketIntelSignal;
