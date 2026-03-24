/**
 * Signal 2: Market Intelligence
 * Scores companies based on funding stage, total funding, hiring velocity,
 * and buying intent signals already captured during enrichment.
 * 
 * Unlike EduThree which calls Apollo News API live, this uses data already
 * available from the enrichment phase to avoid extra API calls.
 */

import type { SignalResult, SignalProvider, SignalContext, SignalName } from '../signal-types.ts';

export const MarketIntelSignal: SignalProvider = {
  name: 'market_intelligence' as SignalName,
  weight: 0.25,

  async calculate(context: SignalContext): Promise<SignalResult> {
    const { company, jobPostings } = context;
    console.log(`  📰 [Signal 2] Market intelligence for ${company.name}`);

    let score = 10; // Baseline
    const signals: string[] = [];

    // Funding analysis
    const fundingStage = company.funding_stage || '';
    const totalFunding = company.total_funding_usd || 0;

    if (fundingStage) {
      const stage = fundingStage.toLowerCase();
      if (stage.includes('series c') || stage.includes('series d') || stage.includes('series e')) {
        score += 25;
        signals.push(`Late-stage funding (${fundingStage})`);
      } else if (stage.includes('series b')) {
        score += 20;
        signals.push('Series B — growth stage');
      } else if (stage.includes('series a')) {
        score += 15;
        signals.push('Series A funded');
      } else if (stage.includes('seed') || stage.includes('angel')) {
        score += 10;
        signals.push('Early-stage funding');
      } else if (stage.includes('ipo') || stage.includes('public')) {
        score += 18;
        signals.push('Publicly traded');
      } else if (stage.includes('private equity') || stage.includes('acquired')) {
        score += 15;
        signals.push('PE-backed or acquired');
      }
    }

    if (totalFunding > 50_000_000) {
      score += 10;
      signals.push(`$${(totalFunding / 1_000_000).toFixed(0)}M+ total funding`);
    } else if (totalFunding > 10_000_000) {
      score += 5;
      signals.push(`$${(totalFunding / 1_000_000).toFixed(0)}M total funding`);
    }

    // Hiring velocity
    const jobs = jobPostings || [];
    const jobCount = Array.isArray(jobs) ? jobs.length : 0;
    if (jobCount > 10) {
      score += 20;
      signals.push(`${jobCount}+ active postings — high hiring velocity`);
    } else if (jobCount > 5) {
      score += 15;
      signals.push(`${jobCount} active postings — actively hiring`);
    } else if (jobCount > 0) {
      score += 8;
      signals.push(`${jobCount} active postings`);
    }

    // Company size as growth proxy
    const sizeStr = company.size || '';
    const sizeNum = parseInt(sizeStr.replace(/[^0-9]/g, ''), 10) || 0;
    if (sizeNum > 500) {
      score += 5;
    }

    score = Math.min(100, score);
    const confidence = signals.length >= 3 ? 0.8 : signals.length >= 1 ? 0.5 : 0.2;

    if (signals.length === 0) signals.push('Limited market signals available');
    console.log(`     ✅ Score: ${score}/100`);

    return { score, confidence, signals, rawData: { fundingStage, totalFunding, jobCount } };
  },
};

export default MarketIntelSignal;
