/**
 * Signal 4: Contact Quality
 * Evaluates decision-maker availability using data already captured
 * during the enrichment phase (contact fields on company_profiles).
 */

import type { SignalResult, SignalProvider, SignalContext, SignalName } from '../signal-types.ts';

export const ContactQualitySignal: SignalProvider = {
  name: 'contact_quality' as SignalName,
  weight: 0.25,

  async calculate(context: SignalContext): Promise<SignalResult> {
    const { company } = context;
    console.log(`  👤 [Signal 4] Contact quality for ${company.name}`);

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
    console.log(`     ✅ Score: ${score}/100`);

    return { score, confidence, signals, rawData: { isDecisionMaker, contactPoints } };
  },
};

export default ContactQualitySignal;
