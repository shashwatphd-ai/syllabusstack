/**
 * GENERATION SERVICE
 * Ported from EduThree1's generation-service.ts (509 lines)
 * 
 * AI-powered project proposal generation with:
 * - 250-line domain-specific prompt
 * - Subject-specific guidance for 6 academic domains
 * - Mandatory specificity formula
 * - Forbidden generic terms with rejection criteria
 * - 30+ skill extraction rules
 * - Market intelligence integration
 * 
 * Adapted to use SyllabusStack's unified-ai-client.ts
 */

import { generateText, MODELS } from '../unified-ai-client.ts';
import type { CompanyInfo, ProjectProposal } from './types.ts';

/**
 * Generate a project proposal for a company + course pairing
 * Uses EduThree1's comprehensive 250-line prompt structure
 */
export async function generateProjectProposal(
  company: CompanyInfo,
  objectives: string[],
  courseTitle: string,
  academicLevel: string,
  expectedArtifacts: string[],
  weeks: number = 15,
  hrsPerWeek: number = 10,
  bloomTier: string = 'Applied'
): Promise<ProjectProposal> {
  // Build company intelligence section from Apollo data
  let intelligenceSection = '';
  const companyJobs = company.job_postings || [];

  if (companyJobs.length > 0 || company.technologies_used?.length || company.funding_stage) {
    intelligenceSection = `\n\nREAL-TIME MARKET INTELLIGENCE (USE THIS DATA):`;
    if (companyJobs.length > 0) {
      const sampleJobs = companyJobs.slice(0, 3).map((j: any) => j.title || j.name).filter(Boolean);
      intelligenceSection += `\n- Active Hiring: ${companyJobs.length} open positions`;
      if (sampleJobs.length > 0) {
        intelligenceSection += ` (${sampleJobs.join(', ')})`;
        intelligenceSection += `\n  → EXTRACT SKILLS FROM JOB TITLES: If hiring for "Data Analyst", include "Data Analysis", "SQL", "Statistical Modeling"`;
      }
    }
    if (company.technologies_used && company.technologies_used.length > 0) {
      intelligenceSection += `\n- Technology Stack: ${company.technologies_used.slice(0, 5).join(', ')}`;
      intelligenceSection += `\n  → INCORPORATE THESE TECHNOLOGIES: Mention specific tools in tasks (e.g., "Build dashboard in ${company.technologies_used[0]}")`;
    }
    if (company.funding_stage) {
      intelligenceSection += `\n- Growth Stage: ${company.funding_stage}`;
      intelligenceSection += `\n  → TAILOR PROJECT SCOPE: ${company.funding_stage === 'Series A' || company.funding_stage === 'Seed' ? 'Focus on growth metrics, customer acquisition' : 'Focus on operational efficiency, scaling'}`;
    }
    if (company.buying_intent_signals && company.buying_intent_signals.length > 0) {
      intelligenceSection += `\n- Buying Signals: ${company.buying_intent_signals.length} detected`;
    }
  }

  const systemPrompt = `You are an elite experiential learning designer creating HIGH-VALUE, SPECIFIC project proposals.

⚠️ ABSOLUTE REQUIREMENTS - FAILURE TO COMPLY WILL RESULT IN REJECTION:

1. FORBIDDEN GENERIC TERMS (Automatic Rejection):
   ❌ "research", "analyze", "synthesis", "investigate", "explore", "recommendations", "report", "memo", "presentation", "findings"
   ❌ Generic skills: "communication", "leadership", "teamwork", "critical thinking", "problem solving"

2. MANDATORY SPECIFICITY IN EVERY ELEMENT:
   ✅ Tasks: MUST include named framework/tool + quantified scope + specific data source
      Example: "Conduct Porter's Five Forces analysis using 2024 IBISWorld data for telehealth market"
   ✅ Deliverables: MUST be named artifacts with format specified
      Example: "Competitive Positioning Matrix in Excel comparing 12 vendors across 15 features"
   ✅ Skills: MUST be domain-specific technical/business skills extracted FROM your tasks
      Example: If task uses "DCF Model", skill = "Discounted Cash Flow Valuation"

3. EXTRACTION RULE - Skills MUST Mirror Tasks:
   - If task mentions "SWOT" → skill = "SWOT Strategic Analysis"
   - If task mentions "SQL" → skill = "SQL Database Querying"
   - If task mentions "Tableau" → skill = "Tableau Data Visualization"
   - If task mentions "survey 200+ customers" → skill = "Primary Customer Research" or "Survey Design & Analysis"

Return ONLY valid JSON, no markdown code blocks.`;

  const prompt = `Design a ${weeks}-week project for ${academicLevel} students that applies COURSE CONCEPTS to solve a company's real-world problem.

🎓 PRIMARY CONSTRAINT: COURSE SUBJECT MATTER (This determines project type)
Course Title: ${courseTitle}
Academic Level: ${academicLevel}

📚 COURSE LEARNING OBJECTIVES (Project MUST enable students to practice these specific skills/concepts):
${objectives.map((o, i) => `LO${i + 1}: ${o}`).join('\n')}

⚠️ CRITICAL REQUIREMENT: The project tasks and deliverables must require students to APPLY the concepts and methods from THIS COURSE.
   - If this is an ENGINEERING/SCIENCE course → Create TECHNICAL project with calculations, simulations, designs
   - If this is a BUSINESS course → Create business strategy/analytics project with frameworks
   - If this is a DATA/CS course → Create software/data analysis project with code, models, systems
   - DO NOT create generic consulting projects that ignore the course subject matter

${expectedArtifacts?.length ? `REQUIRED COURSE DELIVERABLES (must be included in final project):\n${expectedArtifacts.map(a => `- ${a}`).join('\n')}` : ''}

---

🏢 COMPANY PARTNER PROFILE (Context for applying course concepts):
Name: ${company.name}
Sector: ${company.sector}
${company.industries?.length ? `Industries: ${company.industries.join(', ')}` : ''}
Size: ${company.size}
Website: ${company.website || 'Not available'}

📄 COMPANY DESCRIPTION:
${company.description}

${company.keywords?.length ? `🏷️ Company Capabilities: ${company.keywords.slice(0, 10).join(', ')}` : ''}
${intelligenceSection}

---

🎯 PROJECT DESIGN STRATEGY:

1. **IDENTIFY COURSE-COMPANY FIT**:
   - Look at course title and learning objectives to understand what students are learning
   - Identify which company need can be addressed using THOSE SPECIFIC course concepts
   - Create a project that requires students to apply course knowledge to solve that need

2. **SUBJECT-SPECIFIC PROJECT TYPES**:

   📐 For ENGINEERING/TECHNICAL Courses (Mechanical, Electrical, Civil, Aerospace, Chemical, etc.):
   - Focus: Design, calculations, simulations, testing, optimization, analysis using engineering principles
   - Tools: CAD software (SolidWorks, AutoCAD), simulation tools (ANSYS, MATLAB, COMSOL), lab equipment, Python/R
   - Example Tasks: "Calculate heat transfer coefficients using convection equations", "Design structural system using finite element analysis"
   - Example Skills: "Finite Element Analysis", "Thermodynamic Calculations", "CAD Design", "Circuit Analysis"

   💻 For COMPUTER SCIENCE/DATA SCIENCE Courses:
   - Focus: Algorithms, data structures, software development, machine learning, database design, system architecture
   - Tools: Python, Java, SQL, R, TensorFlow, cloud platforms (AWS, Azure), Git, Docker
   - Example Tasks: "Implement recommendation algorithm using collaborative filtering on 100K+ user dataset"
   - Example Skills: "Python Programming", "Machine Learning Model Development", "SQL Database Design"

   📊 For BUSINESS/MANAGEMENT Courses:
   - Focus: Strategy, market analysis, financial modeling, operations, marketing, organizational behavior
   - Tools: Excel, SWOT, Porter's Five Forces, PESTEL, Business Model Canvas, financial models
   - Example Tasks: "Conduct SWOT analysis of 8 competitors using public financial data", "Build DCF valuation model"
   - Example Skills: "SWOT Analysis", "DCF Valuation", "Market Segmentation", "Financial Forecasting"

   🔬 For SCIENCE Courses (Physics, Chemistry, Biology, Environmental Science, etc.):
   - Focus: Experiments, data collection, statistical analysis, lab techniques, scientific method
   - Tools: Lab equipment, statistical software (R, SPSS), data analysis tools
   - Example Skills: "Experimental Design", "Statistical Analysis", "Lab Safety Protocols"

   📐 For MATHEMATICS/STATISTICS Courses:
   - Focus: Mathematical modeling, statistical inference, probability, optimization, computational methods
   - Tools: R, Python (NumPy, SciPy), MATLAB, Mathematica
   - Example Skills: "Regression Analysis", "Monte Carlo Simulation", "Linear Programming"

3. **AVOID MISMATCHES** (These will cause rejection):
   ❌ Engineering course → Generic business consulting
   ❌ Technical course → Project with no calculations, simulations, or technical analysis
   ❌ Any course → Tasks that don't require course-specific knowledge

---

PROJECT CONSTRAINTS:
- Duration: ${weeks} weeks (${weeks * hrsPerWeek} total hours)
- Effort: ${hrsPerWeek} hours/week per student
- Academic Level: ${academicLevel}

---

🚨 QUALITY REQUIREMENTS: SPECIFIC, HIGH-VALUE CONTENT

REJECTION TRIGGERS (Avoid these at ALL costs):
- Tasks/deliverables using vague words: "research", "analyze", "report", "memo", "recommendations", "findings"
- Generic skills: "communication", "leadership", "teamwork", "research", "analysis"
- Tasks without named frameworks/methodologies/tools/equations/software
- Deliverables like "Final Report" or "Analysis Document"

✅ SPECIFICITY FORMULA: [Action Verb] + [Named Framework/Tool] + [Quantified Scope] + [Data/Context]

BAD Task: "Do market research"
GOOD Task: "Survey 200+ target customers using Qualtrics to identify top 5 pain points in product onboarding"

BAD Deliverable: "Technical Report"
GOOD Deliverable: "Structural Analysis Report with FEA Results for 3 Load Cases and Safety Factor Calculations"

Return ONLY valid JSON (no markdown code blocks):
{
  "title": "SPECIFIC project title using real business terms",
  "description": "2-3 sentences describing the business problem, the solution approach, and measurable outcomes",
  "tasks": [
    "Create exactly 7 tasks. EVERY TASK MUST follow: [Action Verb] + [Named Framework/Tool] + [Quantified Scope] + [Data/Context]"
  ],
  "deliverables": [
    "Create exactly 6 deliverables. Each must be a NAMED, CONCRETE artifact with format/tool specified"
  ],
  "skills": [
    "List exactly 7 DOMAIN-SPECIFIC skills EXTRACTED from your tasks.
    
    SKILL EXTRACTION RULES:
    - 'SWOT' → 'SWOT Strategic Analysis'
    - 'Porter\\'s Five Forces' → 'Porter\\'s Five Forces Competitive Analysis'
    - 'DCF' → 'Discounted Cash Flow Valuation'
    - 'Excel model' → 'Financial Modeling in Excel'
    - 'Tableau' → 'Tableau Data Visualization'
    - 'Python' → 'Python Data Analysis'
    - 'SQL' → 'SQL Database Querying'
    - 'A/B testing' → 'A/B Testing & Experimentation'
    - 'customer journey' → 'Customer Journey Mapping'
    - 'BPMN' → 'BPMN Process Mapping'
    - 'survey' → 'Survey Design & Analysis'
    
    ⛔ NEVER include: Communication, Leadership, Teamwork, Research, Analysis, Critical Thinking, Problem Solving"
  ],
  "tier": "standard|advanced|capstone",
  "lo_alignment": "Write 2-3 sentences explaining which SPECIFIC learning objectives (use LO numbers) are addressed by which SPECIFIC tasks and deliverables",
  "contact": {
    "name": "${company.contact_person || 'TBD'}",
    "title": "${company.contact_title || 'TBD'}",
    "email": "${company.contact_email || ''}",
    "phone": "${company.contact_phone || ''}"
  },
  "equipment": "List SPECIFIC software/tools required",
  "majors": ["List 2-4 student majors that would benefit most"]
}`;

  const result = await generateText({
    prompt,
    systemPrompt,
    options: { model: MODELS.PROFESSOR_AI, temperature: 0.4, maxTokens: 5000 },
  });

  const jsonMatch = result.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI did not return valid JSON for project proposal');

  const parsed = JSON.parse(jsonMatch[0]);

  // Clean & validate
  const cleanedTasks = cleanArray(parsed.tasks, 7);
  const cleanedDeliverables = cleanArray(parsed.deliverables, 6);
  const cleanedSkills = cleanArray(parsed.skills, 7);

  return {
    title: parsed.title || `${courseTitle} Project - ${company.name}`,
    company_name: company.name,
    sector: company.sector,
    tasks: cleanedTasks,
    deliverables: cleanedDeliverables,
    tier: parsed.tier || 'standard',
    lo_alignment: parsed.lo_alignment || '',
    description: parsed.description || '',
    skills: cleanedSkills,
    contact: parsed.contact || { name: 'TBD', title: 'TBD', email: '', phone: '' },
    equipment: parsed.equipment || 'Standard computer equipment',
    majors: Array.isArray(parsed.majors) ? parsed.majors : [],
  };
}

/**
 * Clean and validate an array field from AI output
 */
function cleanArray(arr: any, targetLength: number): string[] {
  if (!Array.isArray(arr)) return [];

  return arr
    .filter((item: any) => typeof item === 'string' && item.trim().length > 0)
    .map((item: string) => {
      // Strip markdown formatting
      let cleaned = item.replace(/\*\*/g, '').replace(/`/g, '').trim();
      // Remove leading numbers/bullets
      cleaned = cleaned.replace(/^\d+[\.\)]\s*/, '').trim();
      return cleaned;
    })
    .slice(0, targetLength);
}
