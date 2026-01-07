// EduThree Similarity Utilities
// Keyword-based similarity matching for semantic search
// Per AI Orchestration Implementation Plan - Phase 3

import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { generateKeywordVector, calculateSimilarity } from "./ai-orchestrator.ts";

/**
 * Interface for capability match results
 */
export interface CapabilityMatch {
  id: string;
  name: string;
  category: string | null;
  proficiency_level: string | null;
  course_title: string | null;
  similarity: number;
}

/**
 * Interface for job match results
 */
export interface JobMatch {
  id: string;
  job_title: string;
  requirements_text: string | null;
  match_score: number;
}

/**
 * Interface for requirement match results
 */
export interface RequirementMatch {
  id: string;
  skill_name: string;
  importance: string | null;
  category: string | null;
  matched_capabilities: string[];
  coverage_score: number;
}

/**
 * Find capabilities that match given keywords
 */
export async function findSimilarCapabilities(
  supabase: SupabaseClient,
  targetKeywords: string[],
  userId: string,
  limit: number = 10
): Promise<CapabilityMatch[]> {
  // Get user's capabilities with course info
  const { data: capabilities, error } = await supabase
    .from('capabilities')
    .select(`
      id,
      name,
      category,
      proficiency_level,
      courses(title)
    `)
    .eq('user_id', userId);

  if (error || !capabilities) {
    console.error('Error fetching capabilities:', error);
    return [];
  }

  // Calculate similarity for each capability
  const scored = capabilities.map(cap => {
    const capKeywords = generateKeywordVector(
      `${cap.name} ${cap.category || ''} ${cap.proficiency_level || ''}`
    );
    const similarity = calculateSimilarity(targetKeywords, capKeywords);
    
    return {
      id: cap.id,
      name: cap.name,
      category: cap.category,
      proficiency_level: cap.proficiency_level,
      course_title: (cap.courses as any)?.title || null,
      similarity
    };
  });

  // Sort by similarity and return top matches
  return scored
    .filter(s => s.similarity > 0.05) // Minimum 5% match
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Find job requirements that match user's capabilities
 */
export async function findMatchingJobs(
  supabase: SupabaseClient,
  userCapabilityKeywords: string[],
  limit: number = 5
): Promise<JobMatch[]> {
  // Get popular jobs from cache
  const { data: jobs, error } = await supabase
    .from('job_requirements_cache')
    .select('id, job_query_normalized, requirements_text, keywords')
    .order('query_count', { ascending: false })
    .limit(50);

  if (error || !jobs) {
    console.error('Error fetching jobs:', error);
    return [];
  }

  // Calculate match scores
  const scored = jobs.map(job => {
    // Use stored keywords if available, otherwise generate from text
    const jobKeywords = (job.keywords && job.keywords.length > 0)
      ? job.keywords
      : generateKeywordVector(
          `${job.job_query_normalized} ${job.requirements_text || ''}`
        );
    
    const matchScore = calculateSimilarity(userCapabilityKeywords, jobKeywords) * 100;
    
    return {
      id: job.id,
      job_title: job.job_query_normalized,
      requirements_text: job.requirements_text,
      match_score: Math.round(matchScore)
    };
  });

  return scored
    .filter(s => s.match_score > 10) // Minimum 10% match
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, limit);
}

/**
 * Analyze how well user capabilities cover job requirements
 */
export async function analyzeRequirementCoverage(
  supabase: SupabaseClient,
  dreamJobId: string,
  userId: string
): Promise<{
  coverage_percentage: number;
  covered_requirements: RequirementMatch[];
  uncovered_requirements: RequirementMatch[];
}> {
  // Get job requirements
  const { data: requirements, error: reqError } = await supabase
    .from('job_requirements')
    .select('*')
    .eq('dream_job_id', dreamJobId);

  if (reqError || !requirements) {
    console.error('Error fetching requirements:', reqError);
    return { coverage_percentage: 0, covered_requirements: [], uncovered_requirements: [] };
  }

  // Get user capabilities
  const { data: capabilities, error: capError } = await supabase
    .from('capabilities')
    .select('name, category')
    .eq('user_id', userId);

  if (capError || !capabilities) {
    console.error('Error fetching capabilities:', capError);
    return { coverage_percentage: 0, covered_requirements: [], uncovered_requirements: [] };
  }

  // Build capability keywords for matching
  const capabilityKeywords = capabilities.map(c => 
    generateKeywordVector(`${c.name} ${c.category || ''}`)
  );

  // Analyze each requirement
  const covered: RequirementMatch[] = [];
  const uncovered: RequirementMatch[] = [];

  for (const req of requirements) {
    const reqKeywords = generateKeywordVector(
      `${req.skill_name} ${req.category || ''}`
    );

    // Find matching capabilities
    const matchedCaps: string[] = [];
    let maxCoverage = 0;

    capabilities.forEach((cap, idx) => {
      const similarity = calculateSimilarity(reqKeywords, capabilityKeywords[idx]);
      if (similarity > 0.2) { // 20% threshold for a match
        matchedCaps.push(cap.name);
        maxCoverage = Math.max(maxCoverage, similarity);
      }
    });

    const match: RequirementMatch = {
      id: req.id,
      skill_name: req.skill_name,
      importance: req.importance,
      category: req.category,
      matched_capabilities: matchedCaps,
      coverage_score: maxCoverage * 100
    };

    if (matchedCaps.length > 0) {
      covered.push(match);
    } else {
      uncovered.push(match);
    }
  }

  // Calculate overall coverage weighted by importance
  const weights = { critical: 3, important: 2, nice_to_have: 1 };
  let totalWeight = 0;
  let coveredWeight = 0;

  requirements.forEach(req => {
    const weight = weights[req.importance as keyof typeof weights] || 1;
    totalWeight += weight;
    
    if (covered.find(c => c.id === req.id)) {
      coveredWeight += weight;
    }
  });

  const coverage_percentage = totalWeight > 0 
    ? Math.round((coveredWeight / totalWeight) * 100)
    : 0;

  return {
    coverage_percentage,
    covered_requirements: covered.sort((a, b) => b.coverage_score - a.coverage_score),
    uncovered_requirements: uncovered.sort((a, b) => {
      // Sort by importance first
      const importanceOrder = { critical: 0, important: 1, nice_to_have: 2 };
      return (importanceOrder[a.importance as keyof typeof importanceOrder] || 3) -
             (importanceOrder[b.importance as keyof typeof importanceOrder] || 3);
    })
  };
}

/**
 * Extract and store keywords for a course
 */
export async function updateCourseKeywords(
  supabase: SupabaseClient,
  courseId: string,
  capabilityText: string,
  toolsMethods: string[]
): Promise<void> {
  const keywordsFromText = generateKeywordVector(capabilityText);
  const keywordsFromTools = toolsMethods.flatMap(t => 
    generateKeywordVector(t)
  );
  
  const allKeywords = [...new Set([...keywordsFromText, ...keywordsFromTools])];

  await supabase
    .from('courses')
    .update({ capability_keywords: allKeywords })
    .eq('id', courseId);

  console.log(`Updated keywords for course ${courseId}: ${allKeywords.length} keywords`);
}

/**
 * Extract and store keywords for a dream job
 */
export async function updateDreamJobKeywords(
  supabase: SupabaseClient,
  dreamJobId: string,
  title: string,
  description: string | null,
  requirements: string[]
): Promise<void> {
  const titleKeywords = generateKeywordVector(title);
  const descKeywords = description ? generateKeywordVector(description) : [];
  const reqKeywords = requirements.flatMap(r => generateKeywordVector(r));
  
  const allKeywords = [...new Set([...titleKeywords, ...descKeywords, ...reqKeywords])];

  await supabase
    .from('dream_jobs')
    .update({ requirements_keywords: allKeywords })
    .eq('id', dreamJobId);

  console.log(`Updated keywords for dream job ${dreamJobId}: ${allKeywords.length} keywords`);
}

/**
 * Build aggregated keywords for a user's capability profile
 */
export async function buildUserCapabilityKeywords(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data: capabilities } = await supabase
    .from('capabilities')
    .select('name, category')
    .eq('user_id', userId);

  if (!capabilities || capabilities.length === 0) {
    return [];
  }

  const allKeywords = capabilities.flatMap(cap => 
    generateKeywordVector(`${cap.name} ${cap.category || ''}`)
  );

  // Return unique keywords, sorted by frequency
  const keywordCounts = new Map<string, number>();
  allKeywords.forEach(k => {
    keywordCounts.set(k, (keywordCounts.get(k) || 0) + 1);
  });

  return [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([keyword]) => keyword)
    .slice(0, 200); // Top 200 keywords
}
