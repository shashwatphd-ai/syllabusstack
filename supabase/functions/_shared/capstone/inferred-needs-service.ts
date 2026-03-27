/**
 * Inferred Needs Service
 * Uses AI to synthesize company-specific business needs from job postings,
 * technologies, and company description. Falls back to rule-based inference
 * if AI is unavailable.
 */

import { generateText, MODELS } from '../unified-ai-client.ts';

export interface InferredNeeds {
  needs: string[];
  hiringFocus: string[];
  techCapabilities: string[];
  growthAreas: string[];
}

/**
 * AI-powered need inference — generates unique, company-specific needs
 * by analyzing the company's actual job postings, tech stack, description,
 * and funding stage together.
 */
export async function inferCompanyNeeds(
  jobPostings: any[],
  technologies: string[],
  description: string,
  fundingStage?: string,
  employeeCount?: string,
  companyName?: string,
  companySector?: string
): Promise<InferredNeeds> {
  const jobs = Array.isArray(jobPostings) ? jobPostings : [];
  const tech = Array.isArray(technologies) ? technologies : [];

  // Extract hiring focus from job titles (always useful, even for AI path)
  const hiringFocus = extractHiringFocus(jobs);
  const techCapabilities = tech.slice(0, 10).map(t => typeof t === 'string' ? t : String(t));

  // Try AI-powered inference first
  try {
    const aiNeeds = await inferWithAI(
      companyName || 'Unknown Company',
      companySector || '',
      description || '',
      jobs,
      tech,
      fundingStage || '',
      employeeCount || '',
      hiringFocus
    );

    if (aiNeeds && aiNeeds.length >= 2) {
      return {
        needs: aiNeeds.slice(0, 6),
        hiringFocus,
        techCapabilities,
        growthAreas: extractGrowthAreas(hiringFocus, aiNeeds),
      };
    }
  } catch (error) {
    console.warn(`  ⚠️ AI needs inference failed for ${companyName}: ${error}`);
  }

  // Fallback: rule-based inference
  return ruleBasedInference(jobs, tech, description, fundingStage, companyName, companySector, hiringFocus, techCapabilities);
}

// =============================================================================
// AI-POWERED INFERENCE
// =============================================================================

async function inferWithAI(
  companyName: string,
  sector: string,
  description: string,
  jobs: any[],
  tech: string[],
  fundingStage: string,
  employeeCount: string,
  hiringFocus: string[]
): Promise<string[] | null> {
  const jobSummary = jobs.slice(0, 5).map((j: any) => j.title || '').filter(Boolean).join(', ');
  const techSummary = tech.slice(0, 8).join(', ');

  const prompt = `Analyze this company and identify 3-5 specific, actionable business needs that a university capstone project team could address.

COMPANY: ${companyName}
SECTOR: ${sector || 'Not specified'}
DESCRIPTION: ${description.slice(0, 500) || 'Not available'}
ACTIVE JOB OPENINGS: ${jobSummary || 'None found'}
HIRING FOCUS AREAS: ${hiringFocus.join(', ') || 'Unknown'}
TECHNOLOGY STACK: ${techSummary || 'Not available'}
FUNDING STAGE: ${fundingStage || 'Not specified'}
EMPLOYEE COUNT: ${employeeCount || 'Not specified'}

RULES:
1. Each need MUST be specific to THIS company — not generic like "cloud infrastructure" or "digital transformation"
2. Reference the company's ACTUAL business domain from their description
3. Connect needs to their ACTUAL job openings and tech stack
4. Each need should be 8-15 words, actionable, and specific
5. Do NOT use generic phrases like "modernization", "optimization", "enhancement" without company context

GOOD examples:
- "Automate claims processing workflow for regional insurance operations"
- "Build predictive maintenance dashboard for industrial equipment fleet"
- "Design customer onboarding funnel for B2B SaaS platform"

BAD examples (too generic):
- "Cloud infrastructure modernization"
- "Data analysis and business intelligence"
- "Digital transformation strategy"

Return ONLY a JSON array of strings. No markdown, no explanation.`;

  const result = await generateText({
    prompt,
    systemPrompt: 'You are a business analyst identifying specific, actionable company needs. Return only a JSON array of strings.',
    model: MODELS.FAST,
    temperature: 0.4,
    maxTokens: 500,
  });

  const content = result.content.trim();
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  return parsed.filter((n: any) => typeof n === 'string' && n.length > 10);
}

// =============================================================================
// RULE-BASED FALLBACK
// =============================================================================

function ruleBasedInference(
  jobs: any[],
  tech: string[],
  description: string,
  fundingStage?: string,
  companyName?: string,
  companySector?: string,
  hiringFocus?: string[],
  techCapabilities?: string[]
): InferredNeeds {
  const needs: string[] = [];
  const focus = hiringFocus || [];
  const growthAreas: string[] = [];

  // Job-title-based needs (company-specific phrasing)
  if (focus.some(w => ['engineer', 'developer', 'software', 'backend', 'frontend'].includes(w))) {
    needs.push(`${companyName || 'Company'} software engineering capacity expansion`);
    growthAreas.push('Engineering/Technology');
  }
  if (focus.some(w => ['data', 'analyst', 'analytics', 'scientist'].includes(w))) {
    needs.push(`${companySector || 'Business'} data analytics pipeline for ${companyName || 'operations'}`);
    growthAreas.push('Data & Analytics');
  }
  if (focus.some(w => ['marketing', 'content', 'growth', 'brand'].includes(w))) {
    needs.push(`${companyName || 'Company'} marketing and customer acquisition strategy`);
    growthAreas.push('Marketing');
  }
  if (focus.some(w => ['sales', 'account', 'business', 'revenue'].includes(w))) {
    needs.push(`${companyName || 'Company'} sales pipeline and revenue optimization`);
    growthAreas.push('Sales');
  }
  if (focus.some(w => ['operations', 'supply', 'logistics', 'process'].includes(w))) {
    needs.push(`${companySector || 'Operational'} process improvement for ${companyName || 'organization'}`);
    growthAreas.push('Operations');
  }

  // Description-based needs (specific to company's industry)
  if (description) {
    const desc = description.toLowerCase();
    if (/healthcare|medical|hospital|clinic|patient/.test(desc)) {
      needs.push(`Healthcare compliance and patient data management for ${companyName || 'provider'}`);
    }
    if (/financial|banking|insurance|lending|mortgage/.test(desc)) {
      needs.push(`${companyName || 'Financial'} regulatory compliance and risk analytics`);
    }
    if (/manufacturing|industrial|factory|production/.test(desc)) {
      needs.push(`${companyName || 'Manufacturing'} production optimization and quality control`);
    }
    if (/education|university|school|learning|training/.test(desc)) {
      needs.push(`${companyName || 'Education'} learning platform and student engagement`);
    }
    if (/retail|e-commerce|shop|store|consumer/.test(desc)) {
      needs.push(`${companyName || 'Retail'} customer experience and inventory optimization`);
    }
    if (/construction|architecture|building|real estate|property/.test(desc)) {
      needs.push(`${companyName || 'Construction'} project management and resource planning`);
    }
    if (/logistics|shipping|transport|delivery|freight/.test(desc)) {
      needs.push(`${companyName || 'Logistics'} route optimization and supply chain visibility`);
    }
    if (/legal|law|attorney|compliance/.test(desc)) {
      needs.push(`${companyName || 'Legal'} case management and compliance automation`);
    }
    if (/energy|utility|power|renewable|solar/.test(desc)) {
      needs.push(`${companyName || 'Energy'} grid monitoring and sustainability reporting`);
    }
  }

  // Funding-based needs
  if (fundingStage) {
    const stage = fundingStage.toLowerCase();
    if (stage.includes('seed') || stage.includes('series a')) {
      needs.push(`${companyName || 'Startup'} product-market fit validation and customer discovery`);
    } else if (stage.includes('series b') || stage.includes('series c')) {
      needs.push(`${companyName || 'Growth-stage'} market expansion and operational scaling`);
    }
  }

  // Job volume signal
  if (jobs.length > 10) {
    needs.push(`${companyName || 'Company'} workforce planning for rapid hiring (${jobs.length}+ openings)`);
  }

  return {
    needs: [...new Set(needs)].slice(0, 6),
    hiringFocus: focus,
    techCapabilities: techCapabilities || [],
    growthAreas: [...new Set(growthAreas)],
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function extractHiringFocus(jobs: any[]): string[] {
  if (!Array.isArray(jobs) || jobs.length === 0) return [];

  const titleWords = new Map<string, number>();
  for (const job of jobs) {
    const title = (job.title || '').toLowerCase();
    const words = title.split(/\s+/).filter((w: string) => w.length > 3);
    for (const word of words) {
      titleWords.set(word, (titleWords.get(word) || 0) + 1);
    }
  }

  return [...titleWords.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .filter(([_, count]) => count >= 2)
    .map(([word]) => word);
}

function extractGrowthAreas(hiringFocus: string[], needs: string[]): string[] {
  const areas: string[] = [];
  const combined = [...hiringFocus, ...needs.map(n => n.toLowerCase())].join(' ');

  if (/engineer|developer|software|code|technical/.test(combined)) areas.push('Engineering/Technology');
  if (/data|analytics|analyst|intelligence/.test(combined)) areas.push('Data & Analytics');
  if (/marketing|brand|content|campaign/.test(combined)) areas.push('Marketing');
  if (/sales|revenue|account|business development/.test(combined)) areas.push('Sales');
  if (/operations|process|supply|logistics/.test(combined)) areas.push('Operations');
  if (/finance|accounting|budget|compliance/.test(combined)) areas.push('Finance');

  return [...new Set(areas)];
}
