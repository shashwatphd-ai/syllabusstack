/**
 * Capstone Project Pipeline Types
 * Ported from EduThree1 and adapted for SyllabusStack's data model
 */

export interface CompanyInfo {
  id?: string;
  name: string;
  sector: string;
  size: string;
  description: string;
  website?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_person?: string | null;
  contact_title?: string | null;
  full_address?: string | null;
  linkedin_profile?: string | null;
  apollo_organization_id?: string | null;
  technologies_used?: string[];
  job_postings?: any[];
  funding_stage?: string | null;
  total_funding_usd?: number | null;
  employee_count?: string | null;
  revenue_range?: string | null;
  industries?: string[];
  keywords?: string[];
  buying_intent_signals?: any[];
  data_completeness_score?: number;
  match_score?: number;
  match_reason?: string;
}

export interface ProjectProposal {
  title: string;
  company_name: string;
  sector: string;
  tasks: string[];
  deliverables: string[];
  tier: string;
  lo_alignment: string;
  description: string;
  skills: string[];
  contact: {
    name: string;
    title: string;
    email: string;
    phone: string;
  };
  equipment: string;
  majors: string[];
  lo_alignment_score?: number;
  feasibility_score?: number;
  final_score?: number;
}

export interface CourseContext {
  id: string;
  title: string;
  code?: string;
  location_city?: string;
  location_state?: string;
  location_zip?: string;
  search_location?: string;
  academic_level?: string;
  expected_artifacts?: string[];
  learning_objectives: Array<{
    id: string;
    text: string;
    bloom_level?: string;
  }>;
}

export interface CapstoneProjectInput {
  instructor_course_id: string;
  company_profile_id: string;
  title: string;
  description: string;
  tasks: any;
  deliverables: any;
  skills: string[];
  tier: string;
  lo_alignment: string;
  lo_alignment_score: number;
  feasibility_score: number;
  final_score: number;
  contact: any;
  equipment: string;
  majors: string[];
  status: string;
}

export interface ProjectFormInput {
  capstone_project_id: string;
  form1_project_details: any;
  form2_contact_info: any;
  form3_requirements: any;
  form4_timeline: any;
  form5_logistics: any;
  form6_academic: any;
  milestones: any;
}
