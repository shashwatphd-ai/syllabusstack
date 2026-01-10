// EduThree Centralized AI Schemas
// All structured output schemas for function calling
// Per AI Orchestration Implementation Plan - Phase 1

/**
 * Syllabus Extraction Schema
 * Used by: analyze-syllabus edge function
 */
export const SYLLABUS_EXTRACTION_SCHEMA = {
  name: "extract_capabilities",
  description: "Extract capabilities and course metadata from a course syllabus",
  parameters: {
    type: "object",
    properties: {
      // Course metadata fields
      course_title: {
        type: "string",
        description: "The official course title (e.g., 'Introduction to Machine Learning', 'Strategic Management'). NOT random text or instructions."
      },
      course_code: {
        type: "string",
        description: "Academic course code like 'CS 101', 'MGT 471', 'ENT 315'. Format: 2-4 letters followed by 3-4 digits. NOT ISBN numbers or book codes."
      },
      semester: {
        type: "string",
        description: "Semester/term if mentioned (e.g., 'Fall 2024', 'Spring 2023')"
      },
      credits: {
        type: "number",
        description: "Credit hours if mentioned (typically 1-4)"
      },
      // Skill extraction fields
      capabilities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { 
              type: "string", 
              description: "Capability using 'Can do X' format" 
            },
            category: { 
              type: "string", 
              enum: ["technical", "analytical", "communication", "leadership", "creative", "research", "interpersonal"]
            },
            proficiency_level: { 
              type: "string", 
              enum: ["beginner", "intermediate", "advanced", "expert"]
            },
            evidence_type: {
              type: "string",
              description: "How this skill can be demonstrated to employers"
            }
          },
          required: ["name", "category", "proficiency_level"]
        }
      },
      course_themes: {
        type: "array",
        items: { type: "string" },
        description: "Main themes or focus areas of this course"
      },
      tools_learned: {
        type: "array",
        items: { type: "string" },
        description: "Specific tools, software, or technologies covered"
      }
    },
    required: ["capabilities", "course_title"]
  }
};

/**
 * Job Requirements Schema
 * Used by: analyze-dream-job edge function
 */
export const JOB_REQUIREMENTS_SCHEMA = {
  name: "extract_requirements",
  description: "Extract comprehensive job requirements",
  parameters: {
    type: "object",
    properties: {
      requirements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            skill_name: { 
              type: "string", 
              description: "The skill or requirement name" 
            },
            importance: { 
              type: "string", 
              enum: ["critical", "important", "nice_to_have"]
            },
            category: { 
              type: "string", 
              enum: ["technical", "analytical", "communication", "leadership", "creative", "research", "interpersonal", "certification", "education"]
            }
          },
          required: ["skill_name", "importance", "category"]
        }
      },
      description: { 
        type: "string", 
        description: "Brief description of this role" 
      },
      salary_range: { 
        type: "string", 
        description: "Typical salary range for this role" 
      },
      day_one_capabilities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            requirement: { type: "string" },
            importance: { 
              type: "string", 
              enum: ["critical", "important", "nice_to_have"] 
            }
          },
          required: ["requirement", "importance"]
        },
        description: "What someone needs to be productive on day one"
      },
      differentiators: {
        type: "array",
        items: { type: "string" },
        description: "What sets top candidates apart"
      },
      common_misconceptions: {
        type: "array",
        items: { type: "string" },
        description: "What students wrongly think matters"
      },
      realistic_bar: {
        type: "string",
        description: "Honest description of minimum viable candidate"
      }
    },
    required: ["requirements", "day_one_capabilities"]
  }
};

/**
 * Gap Analysis Schema
 * Used by: gap-analysis edge function
 */
export const GAP_ANALYSIS_SCHEMA = {
  name: "gap_analysis_result",
  description: "Return the comprehensive gap analysis results",
  parameters: {
    type: "object",
    properties: {
      match_score: { 
        type: "number", 
        description: "Overall match percentage 0-100. Be realistic - most students are 30-60%" 
      },
      strong_overlaps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            student_capability: { 
              type: "string", 
              description: "What the student can do" 
            },
            job_requirement: { 
              type: "string", 
              description: "The requirement it matches" 
            },
            assessment: { 
              type: "string", 
              description: "How well it matches" 
            }
          },
          required: ["student_capability", "job_requirement", "assessment"]
        },
        description: "Clear matches between capabilities and requirements"
      },
      critical_gaps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            job_requirement: { 
              type: "string", 
              description: "The missing requirement" 
            },
            student_status: { 
              type: "string", 
              description: "What the student currently has (or lacks)" 
            },
            impact: { 
              type: "string", 
              description: "Why this gap matters" 
            }
          },
          required: ["job_requirement", "student_status", "impact"]
        },
        description: "Requirements the student is missing - especially CRITICAL ones"
      },
      partial_overlaps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            area: { 
              type: "string", 
              description: "The skill area" 
            },
            foundation: { 
              type: "string", 
              description: "What foundation the student has" 
            },
            missing: { 
              type: "string", 
              description: "What's still needed" 
            }
          },
          required: ["area", "foundation", "missing"]
        },
        description: "Areas where student has related but incomplete experience"
      },
      honest_assessment: { 
        type: "string", 
        description: "Candid, direct feedback on their readiness. Be honest but constructive." 
      },
      readiness_level: {
        type: "string",
        enum: ["ready_to_apply", "3_months_away", "6_months_away", "1_year_away", "needs_significant_development"],
        description: "How ready are they to apply for this role?"
      },
      interview_readiness: {
        type: "string",
        description: "Would they pass a typical interview loop? What would trip them up?"
      },
      job_success_prediction: {
        type: "string",
        description: "If hired today, would they succeed? What would be hardest?"
      },
      priority_gaps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            gap: { type: "string" },
            priority: { 
              type: "number", 
              description: "1 = highest priority" 
            },
            reason: { 
              type: "string", 
              description: "Why this should be addressed first" 
            }
          },
          required: ["gap", "priority", "reason"]
        },
        description: "Top 3-5 gaps ranked by impact if closed"
      },
      anti_recommendations: { 
        type: "array", 
        items: { type: "string" },
        description: "Things the student should NOT pursue or avoid" 
      }
    },
    required: ["match_score", "strong_overlaps", "critical_gaps", "honest_assessment", "readiness_level", "priority_gaps"]
  }
};

/**
 * Recommendations Schema
 * Used by: generate-recommendations edge function
 *
 * IMPORTANT: This schema generates action plans WITHOUT URLs.
 * Real course URLs are discovered via Firecrawl integration separately.
 * Types: project, course, certification, action, reading, skill, experience
 */
export const RECOMMENDATIONS_SCHEMA = {
  name: "generate_recommendations",
  description: "Generate comprehensive, actionable learning recommendations. Focus on actionable plans - real course URLs will be found separately via search.",
  parameters: {
    type: "object",
    properties: {
      recommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Clear, specific action title (e.g., 'Build ML Classification Project', 'Complete Python Data Science Track')"
            },
            type: {
              type: "string",
              enum: ["project", "course", "certification", "action", "reading", "skill", "experience", "networking", "portfolio"],
              description: "project=build something, course=take a course, certification=get certified, action=one-time task, reading=books/articles, skill=practice specific skill, experience=get real-world experience, networking=connect with people, portfolio=build portfolio pieces"
            },
            description: {
              type: "string",
              description: "What they'll learn or do - be specific and actionable"
            },
            why_this_matters: {
              type: "string",
              description: "How this directly connects to the job requirement and helps their candidacy"
            },
            gap_addressed: {
              type: "string",
              description: "Which specific gap from the analysis this closes"
            },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  order: { type: "number", description: "Step number starting from 1" },
                  description: { type: "string", description: "Clear action to take" },
                  estimated_time: { type: "string", description: "How long this step takes (e.g., '2 hours', '1 week')" }
                },
                required: ["order", "description"]
              },
              description: "Concrete, numbered steps to complete this recommendation"
            },
            provider: {
              type: "string",
              description: "Suggested platform (Coursera, Udemy, GitHub, Kaggle, etc.) - real URLs will be found via search"
            },
            duration: {
              type: "string",
              description: "Total estimated time to complete (e.g., '4 weeks', '20 hours')"
            },
            effort_hours: {
              type: "number",
              description: "Estimated total hours of effort"
            },
            cost: {
              type: "number",
              description: "Estimated cost in USD (0 for free resources)"
            },
            priority: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "high=addresses critical gap, medium=important but not urgent, low=nice to have"
            },
            evidence_created: {
              type: "string",
              description: "What tangible evidence they'll have after completion (GitHub repo, certificate, portfolio piece, etc.)"
            },
            how_to_demonstrate: {
              type: "string",
              description: "How to present this accomplishment to employers in resume/interview"
            }
          },
          required: ["title", "type", "description", "why_this_matters", "priority", "gap_addressed"]
        },
        description: "5-10 specific, actionable recommendations addressing the priority gaps"
      },
      anti_recommendations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            action: {
              type: "string",
              description: "What NOT to do (be specific)"
            },
            reason: {
              type: "string",
              description: "Why this is a waste of time/money for THIS student and THIS role"
            }
          },
          required: ["action", "reason"]
        },
        description: "3-5 things the student should AVOID doing - common mistakes for this career path"
      },
      learning_path_summary: {
        type: "string",
        description: "Brief 2-3 sentence summary of the recommended path forward with realistic timeline"
      }
    },
    required: ["recommendations", "anti_recommendations", "learning_path_summary"]
  }
};

/**
 * Schema type definition for all schemas
 */
export interface AISchema {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Helper function to create tool definition from schema
 */
export function createToolDefinition(schema: AISchema) {
  return {
    type: "function" as const,
    function: {
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters
    }
  };
}

/**
 * Helper function to create tool_choice for a schema
 */
export function createToolChoice(schema: AISchema) {
  return { 
    type: "function" as const, 
    function: { name: schema.name } 
  };
}
