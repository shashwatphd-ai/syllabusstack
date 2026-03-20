/**
 * Capstone Project Generation Service
 * Generates AI-powered project proposals using SyllabusStack's unified AI client
 * Adapted from EduThree1's 509-line generation-service.ts
 */

import { generateText, MODELS } from '../unified-ai-client.ts';
import type { CompanyInfo, ProjectProposal } from './types.ts';

/**
 * Generate a project proposal for a company + course pairing
 */
export async function generateProjectProposal(
  company: CompanyInfo,
  objectives: string[],
  courseTitle: string,
  academicLevel: string,
  expectedArtifacts: string[]
): Promise<ProjectProposal> {
  // Build company intelligence section
  let intel = '';
  const jobs = company.job_postings || [];
  if (jobs.length > 0) {
    const sampleJobs = jobs.slice(0, 3).map((j: any) => j.title || j.name).filter(Boolean);
    intel += `\n- Active Hiring: ${jobs.length} positions (${sampleJobs.join(', ')})`;
  }
  if (company.technologies_used?.length) {
    intel += `\n- Tech Stack: ${company.technologies_used.slice(0, 5).join(', ')}`;
  }
  if (company.funding_stage) {
    intel += `\n- Growth Stage: ${company.funding_stage}`;
  }

  const prompt = `Design a capstone project for ${academicLevel || 'undergraduate'} students that applies COURSE CONCEPTS to solve a company problem.

🎓 COURSE: ${courseTitle}
📚 LEARNING OBJECTIVES:
${objectives.map((o, i) => `LO${i + 1}: ${o}`).join('\n')}

${expectedArtifacts?.length ? `REQUIRED DELIVERABLES:\n${expectedArtifacts.map(a => `- ${a}`).join('\n')}` : ''}

🏢 COMPANY: ${company.name}
Sector: ${company.sector}
Size: ${company.size}
Description: ${company.description}
${company.industries?.length ? `Industries: ${company.industries.join(', ')}` : ''}
${intel}

Return ONLY valid JSON (no markdown):
{
  "title": "Specific project title",
  "description": "2-3 sentence problem + approach + outcomes",
  "tasks": ["7 specific tasks with named frameworks/tools and quantified scope"],
  "deliverables": ["6 named concrete artifacts with format specified"],
  "skills": ["5-7 domain-specific technical skills"],
  "tier": "standard|advanced|capstone",
  "lo_alignment": "Explanation of how project maps to course LOs",
  "contact": {"name": "${company.contact_person || 'TBD'}", "title": "${company.contact_title || 'TBD'}", "email": "${company.contact_email || ''}", "phone": "${company.contact_phone || ''}"},
  "equipment": "Required equipment/software",
  "majors": ["2-3 suitable majors"]
}`;

  const result = await generateText({
    prompt,
    systemPrompt: `You are an elite experiential learning designer. Create HIGH-VALUE, SPECIFIC project proposals. Avoid generic terms like "research", "analyze", "report". Every task must include a named framework/tool + quantified scope. Return ONLY valid JSON.`,
    options: { model: MODELS.PROFESSOR_AI, temperature: 0.7, maxTokens: 4000 },
  });

  const jsonMatch = result.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI did not return valid JSON for project proposal');

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    title: parsed.title || `${courseTitle} Project - ${company.name}`,
    company_name: company.name,
    sector: company.sector,
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    deliverables: Array.isArray(parsed.deliverables) ? parsed.deliverables : [],
    tier: parsed.tier || 'standard',
    lo_alignment: parsed.lo_alignment || '',
    description: parsed.description || '',
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    contact: parsed.contact || { name: 'TBD', title: 'TBD', email: '', phone: '' },
    equipment: parsed.equipment || 'Standard computer equipment',
    majors: Array.isArray(parsed.majors) ? parsed.majors : [],
  };
}
