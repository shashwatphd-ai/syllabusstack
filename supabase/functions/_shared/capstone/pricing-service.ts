/**
 * Apollo-Enriched Pricing & ROI Calculation Service
 * Ported from EduThree1's pricing-service.ts (508 lines)
 * 
 * Calculates project budget using 7 pricing factors from Apollo data:
 * 1. Buying intent signals
 * 2. Hiring velocity
 * 3. Funding stage & capital
 * 4. Technology stack complexity
 * 5. Company size & scale
 * 6. Revenue range
 * 7. Strategic needs
 */

import type { CompanyInfo } from './types.ts';

export interface PricingResult {
  budget: number;
  breakdown: PricingBreakdown;
}

export interface PricingBreakdown {
  base_calculation: {
    weeks: number;
    hours_per_week: number;
    team_size: number;
    total_hours: number;
    rate_per_hour: number;
    labor_cost: number;
    materials: number;
    subtotal: number;
  };
  apollo_intelligence_applied: Array<{
    factor: string;
    multiplier: number;
    rationale: string;
    [key: string]: any;
  }>;
  market_signals_detected: Array<{
    type: string;
    signal: string;
    strength: string;
  }>;
  final_budget: number;
  data_enrichment_source: string;
  apollo_data_quality: number;
}

export interface ROIResult {
  project_cost: number;
  total_value: number;
  roi_multiplier: number;
  net_value: number;
  value_components: any[];
  data_source: string;
  confidence_level: string;
}

/**
 * Calculate Apollo-enriched pricing for a capstone project
 */
export function calculateApolloEnrichedPricing(
  weeks: number,
  hrsPerWeek: number,
  teamSize: number,
  tier: string,
  company: CompanyInfo
): PricingResult {
  // Base calculation using student labor rates
  const totalHours = weeks * hrsPerWeek * teamSize;
  const laborRate = 20; // Student rate per hour
  const laborCost = totalHours * laborRate;
  const materials = 300; // Standard materials/tools cost

  let budget = laborCost + materials;

  const breakdown: PricingBreakdown = {
    base_calculation: {
      weeks,
      hours_per_week: hrsPerWeek,
      team_size: teamSize,
      total_hours: totalHours,
      rate_per_hour: laborRate,
      labor_cost: laborCost,
      materials,
      subtotal: budget
    },
    apollo_intelligence_applied: [],
    market_signals_detected: [],
    final_budget: 0,
    data_enrichment_source: 'Apollo.io',
    apollo_data_quality: company.data_completeness_score || 0
  };

  // 1. BUYING INTENT SIGNALS
  const buyingIntentSignals = company.buying_intent_signals;
  if (buyingIntentSignals && Array.isArray(buyingIntentSignals) && buyingIntentSignals.length > 0) {
    const highIntentSignals = buyingIntentSignals.filter((s: any) =>
      s.strength === 'high' || s.strength === 'strong'
    );

    if (highIntentSignals.length > 0) {
      const multiplier = 1.20 + (highIntentSignals.length * 0.05);
      budget *= multiplier;
      breakdown.apollo_intelligence_applied.push({
        factor: 'High Buying Intent',
        signals: highIntentSignals.map((s: any) => s.signal),
        multiplier,
        rationale: `${highIntentSignals.length} strong buying signals detected - company is actively seeking solutions`
      });

      highIntentSignals.forEach((signal: any) => {
        breakdown.market_signals_detected.push({
          type: signal.type || 'buying_intent',
          signal: signal.signal || signal.details || '',
          strength: signal.strength
        });
      });
    }
  }

  // 2. HIRING VELOCITY
  const jobPostings = company.job_postings || [];
  if (Array.isArray(jobPostings) && jobPostings.length > 0) {
    const relevantRoles = jobPostings.length;
    let hiringMultiplier = 1.0;

    if (relevantRoles >= 5) {
      hiringMultiplier = 1.25;
    } else if (relevantRoles >= 2) {
      hiringMultiplier = 1.15;
    }

    if (hiringMultiplier > 1.0) {
      budget *= hiringMultiplier;
      breakdown.apollo_intelligence_applied.push({
        factor: 'Active Hiring',
        open_positions: relevantRoles,
        multiplier: hiringMultiplier,
        rationale: `Company has ${relevantRoles} open positions - high demand for talent`
      });

      breakdown.market_signals_detected.push({
        type: 'hiring_velocity',
        signal: `${relevantRoles} open positions`,
        strength: relevantRoles >= 5 ? 'high' : 'medium'
      });
    }
  }

  // 3. FUNDING STAGE & CAPITAL
  const fundingStage = company.funding_stage;
  const totalFunding = company.total_funding_usd;

  if (fundingStage || totalFunding) {
    let fundingMultiplier = 1.0;
    let rationale = '';

    if (totalFunding && totalFunding > 0) {
      if (totalFunding >= 50000000) {
        fundingMultiplier = 1.35;
        rationale = `Well-capitalized ($${(totalFunding / 1000000).toFixed(1)}M raised) - premium pricing justified`;
      } else if (totalFunding >= 10000000) {
        fundingMultiplier = 1.20;
        rationale = `Strong funding ($${(totalFunding / 1000000).toFixed(1)}M raised)`;
      } else if (totalFunding >= 1000000) {
        fundingMultiplier = 1.10;
        rationale = `Funded company ($${(totalFunding / 1000000).toFixed(1)}M raised)`;
      }
    } else if (fundingStage) {
      const stageMultipliers: Record<string, number> = {
        'Seed': 0.95,
        'Series A': 1.10,
        'Series B': 1.25,
        'Series C': 1.30,
        'Series C+': 1.35,
        'Series D+': 1.40,
        'IPO': 1.50,
        'Public': 1.50,
        'Private Equity': 1.40
      };

      if (stageMultipliers[fundingStage]) {
        fundingMultiplier = stageMultipliers[fundingStage];
        rationale = `${fundingStage} funding stage indicates strong financial position`;
      }
    }

    if (fundingMultiplier !== 1.0) {
      budget *= fundingMultiplier;
      breakdown.apollo_intelligence_applied.push({
        factor: 'Funding & Capital',
        funding_stage: fundingStage,
        total_funding_usd: totalFunding,
        multiplier: fundingMultiplier,
        rationale
      });

      breakdown.market_signals_detected.push({
        type: 'funding',
        signal: totalFunding ? `$${(totalFunding / 1000000).toFixed(1)}M raised` : fundingStage || '',
        strength: totalFunding && totalFunding >= 50000000 ? 'high' : 'medium'
      });
    }
  }

  // 4. TECHNOLOGY STACK COMPLEXITY
  if (company.technologies_used && Array.isArray(company.technologies_used) && company.technologies_used.length > 0) {
    const advancedTechnologies = [
      'AI', 'ML', 'Machine Learning', 'Artificial Intelligence',
      'Cloud', 'AWS', 'Azure', 'GCP', 'Kubernetes', 'Docker',
      'React', 'Python', 'TensorFlow', 'PyTorch',
      'Blockchain', 'IoT', 'Edge Computing',
      'Data Science', 'Big Data', 'Analytics'
    ];

    const techMatches = company.technologies_used.filter((tech: string) =>
      advancedTechnologies.some(advTech =>
        tech.toLowerCase().includes(advTech.toLowerCase())
      )
    );

    if (techMatches.length >= 3) {
      budget *= 1.25;
      breakdown.apollo_intelligence_applied.push({
        factor: 'Advanced Technology Stack',
        technologies: techMatches,
        multiplier: 1.25,
        rationale: `Company uses ${techMatches.length} cutting-edge technologies`
      });
    } else if (techMatches.length >= 1) {
      budget *= 1.10;
      breakdown.apollo_intelligence_applied.push({
        factor: 'Modern Technology Stack',
        technologies: techMatches,
        multiplier: 1.10,
        rationale: 'Moderate technology complexity'
      });
    }
  }

  // 5. COMPANY SIZE & SCALE
  const employeeCount = company.employee_count || company.size || '';
  let sizeMultiplier = 1.0;
  let sizeRationale = '';

  if (typeof employeeCount === 'string') {
    if (employeeCount.includes('10,000') || employeeCount.includes('5,001')) {
      sizeMultiplier = 1.30;
      sizeRationale = 'Enterprise scale organization';
    } else if (employeeCount.includes('1,001') || employeeCount.includes('501')) {
      sizeMultiplier = 1.20;
      sizeRationale = 'Large organization';
    } else if (employeeCount.includes('201') || employeeCount.includes('101')) {
      sizeMultiplier = 1.10;
      sizeRationale = 'Mid-size organization';
    } else if (employeeCount.includes('11') || employeeCount.includes('1-10')) {
      sizeMultiplier = 0.90;
      sizeRationale = 'Small organization - discounted rate';
    }
  }

  if (sizeMultiplier !== 1.0) {
    budget *= sizeMultiplier;
    breakdown.apollo_intelligence_applied.push({
      factor: 'Organization Scale',
      employee_count: employeeCount,
      multiplier: sizeMultiplier,
      rationale: sizeRationale
    });
  }

  // 6. REVENUE RANGE
  const revenueRange = company.revenue_range || '';
  if (revenueRange) {
    let revenueMultiplier = 1.0;

    if (revenueRange.includes('$1B') || revenueRange.includes('$500M')) {
      revenueMultiplier = 1.25;
    } else if (revenueRange.includes('$100M')) {
      revenueMultiplier = 1.15;
    } else if (revenueRange.includes('$50M')) {
      revenueMultiplier = 1.10;
    }

    if (revenueMultiplier > 1.0) {
      budget *= revenueMultiplier;
      breakdown.apollo_intelligence_applied.push({
        factor: 'Revenue Scale',
        revenue_range: revenueRange,
        multiplier: revenueMultiplier,
        rationale: 'Strong revenue indicates budget capacity'
      });
    }
  }

  budget = Math.round(budget / 100) * 100;
  breakdown.final_budget = budget;

  return { budget, breakdown };
}

/**
 * Calculate ROI based on deliverables and company intelligence
 */
export function calculateApolloEnrichedROI(
  budget: number,
  deliverables: string[],
  company: CompanyInfo,
  tasks: string[]
): ROIResult {
  let totalValue = budget;
  const valueComponents: any[] = [];

  // 1. DELIVERABLE MARKET VALUE
  const deliverableValues: Record<string, number> = {
    'Market Research': 8000,
    'Competitive Analysis': 7000,
    'Financial Model': 12000,
    'Prototype': 25000,
    'Dashboard': 15000,
    'Analytics': 20000,
    'Strategy': 10000,
    'Process': 18000,
    'Business Plan': 9000,
    'Marketing': 11000,
    'Data Analysis': 6000,
    'Feasibility': 8500,
    'Documentation': 5000,
    'AI Model': 35000,
    'Pipeline': 22000,
  };

  let deliverableValue = 0;
  const deliverableBreakdown: any[] = [];

  deliverables.forEach(deliverable => {
    Object.entries(deliverableValues).forEach(([key, value]) => {
      if (deliverable.toLowerCase().includes(key.toLowerCase())) {
        deliverableValue += value;
        deliverableBreakdown.push({
          deliverable,
          market_value: value,
          rationale: `Professional ${key} consulting typically costs $${value.toLocaleString()}`
        });
      }
    });
  });

  if (deliverableValue > 0) {
    totalValue += deliverableValue;
    valueComponents.push({
      category: 'Professional Deliverables',
      value: deliverableValue,
      weight: 0.35,
      breakdown: deliverableBreakdown
    });
  }

  // 2. TALENT PIPELINE VALUE
  const jobPostings = company.job_postings || [];
  if (Array.isArray(jobPostings) && jobPostings.length > 0) {
    const avgRecruitingCost = 8000;
    const qualifiedCandidates = Math.min(3, jobPostings.length);
    const recruitingSavings = qualifiedCandidates * avgRecruitingCost * 0.60;
    const preVettedValue = qualifiedCandidates * 2000;

    const talentValue = recruitingSavings + preVettedValue;
    totalValue += talentValue;

    valueComponents.push({
      category: 'Talent Pipeline Access',
      value: talentValue,
      weight: 0.20,
      breakdown: {
        open_positions: jobPostings.length,
        qualified_candidates: qualifiedCandidates,
        recruiting_cost_savings: recruitingSavings,
        rationale: `${jobPostings.length} active openings - direct pipeline to pre-vetted talent`
      }
    });
  }

  // 3. STRATEGIC CONSULTING VALUE
  const fundingAmount = company.total_funding_usd;
  let strategicValue = 0;

  if (fundingAmount && fundingAmount > 0) {
    if (fundingAmount >= 50000000) strategicValue = budget * 0.40;
    else if (fundingAmount >= 10000000) strategicValue = budget * 0.30;
    else if (fundingAmount >= 1000000) strategicValue = budget * 0.20;
  }

  if (strategicValue > 0) {
    totalValue += strategicValue;
    valueComponents.push({
      category: 'Strategic Innovation Consulting',
      value: strategicValue,
      weight: 0.15,
      breakdown: {
        total_funding: fundingAmount,
        rationale: `Well-funded companies benefit from external innovation perspectives`
      }
    });
  }

  // 4. TECHNOLOGY TRANSFER VALUE
  const techTransferValue = company.technologies_used?.length
    ? budget * 0.25
    : budget * 0.15;
  totalValue += techTransferValue;

  valueComponents.push({
    category: 'Academic Research & Technology Transfer',
    value: techTransferValue,
    weight: 0.15,
    breakdown: {
      technologies: company.technologies_used || [],
      rationale: 'Students bring cutting-edge academic research and modern practices'
    }
  });

  // 5. RISK MITIGATION VALUE
  const riskValue = budget * 0.10;
  totalValue += riskValue;

  valueComponents.push({
    category: 'Risk-Free Pilot Program',
    value: riskValue,
    weight: 0.05,
    breakdown: {
      rationale: 'Test solutions and team fit before full-time hiring commitments'
    }
  });

  return {
    project_cost: budget,
    total_value: Math.round(totalValue),
    roi_multiplier: parseFloat((totalValue / budget).toFixed(2)),
    net_value: Math.round(totalValue - budget),
    value_components: valueComponents,
    data_source: 'Apollo.io Market Intelligence',
    confidence_level: (company.data_completeness_score || 0) >= 60 ? 'high' : 'medium'
  };
}
