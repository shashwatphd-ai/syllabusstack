/**
 * Inferred Needs Service
 * Synthesizes company business needs from job postings + technologies
 * for richer AI project generation prompts.
 */

export interface InferredNeeds {
  needs: string[];
  hiringFocus: string[];
  techCapabilities: string[];
  growthAreas: string[];
}

/**
 * Synthesize business needs from company data.
 */
export function inferCompanyNeeds(
  jobPostings: any[],
  technologies: string[],
  description: string,
  fundingStage?: string,
  employeeCount?: string
): InferredNeeds {
  const needs: string[] = [];
  const hiringFocus: string[] = [];
  const techCapabilities: string[] = [];
  const growthAreas: string[] = [];

  // Analyze job postings for hiring focus areas
  if (Array.isArray(jobPostings) && jobPostings.length > 0) {
    const titleWords = new Map<string, number>();
    for (const job of jobPostings) {
      const title = (job.title || '').toLowerCase();
      const words = title.split(/\s+/).filter((w: string) => w.length > 3);
      for (const word of words) {
        titleWords.set(word, (titleWords.get(word) || 0) + 1);
      }
    }

    // Top hiring focus areas
    const sorted = [...titleWords.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [word, count] of sorted) {
      if (count >= 2) hiringFocus.push(word);
    }

    // Infer needs from job titles
    if (hiringFocus.some(w => ['engineer', 'developer', 'software', 'backend', 'frontend'].includes(w))) {
      needs.push('Software development and engineering talent');
      growthAreas.push('Engineering/Technology');
    }
    if (hiringFocus.some(w => ['data', 'analyst', 'analytics', 'scientist'].includes(w))) {
      needs.push('Data analysis and business intelligence');
      growthAreas.push('Data & Analytics');
    }
    if (hiringFocus.some(w => ['marketing', 'content', 'growth', 'brand'].includes(w))) {
      needs.push('Marketing and brand growth');
      growthAreas.push('Marketing');
    }
    if (hiringFocus.some(w => ['sales', 'account', 'business', 'revenue'].includes(w))) {
      needs.push('Sales and business development');
      growthAreas.push('Sales');
    }
    if (hiringFocus.some(w => ['operations', 'supply', 'logistics', 'process'].includes(w))) {
      needs.push('Operational efficiency and process improvement');
      growthAreas.push('Operations');
    }

    if (jobPostings.length > 10) {
      needs.push('Rapid scaling and workforce growth');
    }
  }

  // Technology capabilities
  if (technologies.length > 0) {
    techCapabilities.push(...technologies.slice(0, 10));

    if (technologies.some(t => /python|tensorflow|pytorch|machine\s*learning/i.test(t))) {
      needs.push('AI/ML capability development');
    }
    if (technologies.some(t => /aws|azure|gcp|cloud/i.test(t))) {
      needs.push('Cloud infrastructure and DevOps');
    }
    if (technologies.some(t => /react|angular|vue|next/i.test(t))) {
      needs.push('Modern web application development');
    }
  }

  // Growth stage needs
  if (fundingStage) {
    const stage = fundingStage.toLowerCase();
    if (stage.includes('seed') || stage.includes('series a')) {
      needs.push('Product-market fit validation');
      needs.push('Customer acquisition strategy');
    } else if (stage.includes('series b') || stage.includes('series c')) {
      needs.push('Scaling operations and processes');
      needs.push('Market expansion strategy');
    } else if (stage.includes('ipo') || stage.includes('public')) {
      needs.push('Operational efficiency at scale');
    }
  }

  // Deduplicate
  return {
    needs: [...new Set(needs)].slice(0, 8),
    hiringFocus: [...new Set(hiringFocus)],
    techCapabilities: [...new Set(techCapabilities)],
    growthAreas: [...new Set(growthAreas)],
  };
}
