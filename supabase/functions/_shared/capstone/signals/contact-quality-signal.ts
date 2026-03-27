/**
 * Signal 4: Contact Quality
 * Evaluates decision-maker availability using data already captured
 * during the enrichment phase (contact fields on company_profiles).
 *
 * Enhanced with Apollo People Search for active decision-maker discovery.
 */

import type { SignalResult, SignalProvider, SignalContext, SignalName } from '../signal-types.ts';
import { withApolloCircuit } from '../circuit-breaker.ts';

// =============================================================================
// APOLLO PEOPLE SEARCH INTEGRATION
// =============================================================================

async function searchDecisionMakers(orgId: string, apolloApiKey: string): Promise<any[]> {
  if (!orgId || !apolloApiKey) return [];

  try {
    const response = await withApolloCircuit(() =>
      fetch('https://api.apollo.io/v1/mixed_people/search', {
        method: 'POST',
        headers: {
          'X-Api-Key': apolloApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_ids: [orgId],
          person_seniorities: ['c_suite', 'vp', 'director', 'owner', 'founder', 'partner'],
          per_page: 25,
        }),
      }).then(res => res.json())
    );
    return response.people || [];
  } catch (error) {
    console.warn(`  ⚠️ [Signal 4] Apollo People Search error: ${error}`);
    return [];
  }
}

function scorePeopleResults(people: any[], syllabusDomain: string): { score: number; signals: string[] } {
  const signals: string[] = [];

  // Base score
  let score = 10;

  // Decision-maker count (0-40 points for up to 10 DMs)
  const dmScore = Math.min(40, people.length * 4);
  score += dmScore;
  if (people.length > 0) {
    signals.push(`${people.length} decision-maker(s) found`);
  }

  // Department relevance
  const domainLower = (syllabusDomain || '').toLowerCase();
  let targetDepartments: string[];
  if (domainLower.includes('engineering') || domainLower.includes('cs') || domainLower.includes('computer')) {
    targetDepartments = ['engineering', 'technology', 'it', 'r&d', 'product'];
  } else if (domainLower.includes('business') || domainLower.includes('mba') || domainLower.includes('management')) {
    targetDepartments = ['operations', 'strategy', 'finance', 'marketing', 'sales'];
  } else {
    targetDepartments = ['engineering', 'operations', 'strategy'];
  }

  const deptMatches = people.filter(p => {
    const dept = (p.department || p.departments?.join(' ') || '').toLowerCase();
    return targetDepartments.some(t => dept.includes(t));
  });
  const deptScore = Math.min(25, deptMatches.length * 8);
  score += deptScore;
  if (deptMatches.length > 0) {
    signals.push(`${deptMatches.length} contact(s) in relevant departments`);
  }

  // Email verified (0-15 points)
  const verifiedCount = people.filter(p => p.email_status === 'verified').length;
  const verifiedScore = Math.min(15, verifiedCount * 3);
  score += verifiedScore;
  if (verifiedCount > 0) {
    signals.push(`${verifiedCount} verified email(s)`);
  }

  // Champion titles — C-suite specifically (0-10 points)
  const cSuiteCount = people.filter(p => {
    const title = (p.title || '').toLowerCase();
    return ['ceo', 'cto', 'cfo', 'coo', 'cmo', 'cio', 'cpo', 'chief'].some(t => title.includes(t));
  }).length;
  const championScore = Math.min(10, cSuiteCount * 5);
  score += championScore;
  if (cSuiteCount > 0) {
    signals.push(`${cSuiteCount} C-suite contact(s) identified`);
  }

  score = Math.min(100, score);

  return { score, signals };
}

// =============================================================================
// SIGNAL PROVIDER
// =============================================================================

export const ContactQualitySignal: SignalProvider = {
  name: 'contact_quality' as SignalName,
  weight: 0.20,

  async calculate(context: SignalContext): Promise<SignalResult> {
    const { company } = context;
    const apolloApiKey = context.apolloApiKey;
    const orgId = company.apollo_organization_id;
    const domain = context.syllabusDomain;
    console.log(`  👤 [Signal 4] Contact quality for ${company.name}`);

    // Try live Apollo People Search first
    const people = await searchDecisionMakers(orgId || '', apolloApiKey || '');

    if (people.length > 0) {
      // Use live people search results
      const result = scorePeopleResults(people, domain || '');
      const confidence = result.score >= 60 ? 0.8 : result.score >= 30 ? 0.5 : 0.3;
      console.log(`     ✅ Score: ${result.score}/100 (live search, ${people.length} contacts)`);
      return { score: result.score, confidence, signals: result.signals, rawData: { source: 'apollo_people_search', peopleCount: people.length } };
    }

    // Fallback: static scoring from enrichment data
    let score = 0;
    const signals: string[] = [];

    // Has any contact
    const hasContact = !!(company.contact_person || company.contact_email);
    if (hasContact) {
      score += 10;
      signals.push('Contact person identified');
    }

    // Email quality
    if (company.contact_email && company.contact_email.includes('@')) {
      score += 30;
      signals.push('Verified email available');
    }

    // Title quality (decision-maker)
    const title = (company.contact_title || '').toLowerCase();
    const isDecisionMaker = ['vp', 'vice president', 'director', 'chief', 'head of', 'manager', 'senior', 'lead', 'owner', 'founder', 'partner', 'c-suite', 'cto', 'ceo', 'coo', 'cfo', 'cmo'].some(t => title.includes(t));
    if (isDecisionMaker) {
      score += 30;
      signals.push(`Decision-maker: ${company.contact_title}`);
    } else if (company.contact_title) {
      score += 15;
      signals.push(`Contact title: ${company.contact_title}`);
    }

    // Phone availability
    const contactPhone = (company as any).contact_phone;
    if (contactPhone) {
      score += 10;
      signals.push('Phone number available');
    }

    // LinkedIn
    const linkedinProfile = (company as any).linkedin_profile;
    if (linkedinProfile) {
      score += 10;
      signals.push('LinkedIn profile available');
    }

    // Multiple contact options bonus
    const contactPoints = [company.contact_email, contactPhone, linkedinProfile].filter(Boolean).length;
    if (contactPoints >= 3) {
      score += 10;
      signals.push('Multiple contact channels');
    }

    score = Math.min(100, score);
    if (signals.length === 0) signals.push('No contact data available');

    const confidence = contactPoints >= 2 ? 0.7 : contactPoints >= 1 ? 0.4 : 0.1;
    console.log(`     ✅ Score: ${score}/100 (static fallback)`);

    return { score, confidence, signals, rawData: { source: 'static_enrichment', isDecisionMaker, contactPoints } };
  },
};

export default ContactQualitySignal;
