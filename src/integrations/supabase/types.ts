export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string | null
          description: string
          icon: string
          id: string
          key: string
          name: string
          requirement_count: number | null
          requirement_type: string
          tier: string | null
          xp_reward: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          icon: string
          id?: string
          key: string
          name: string
          requirement_count?: number | null
          requirement_type: string
          tier?: string | null
          xp_reward?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          icon?: string
          id?: string
          key?: string
          name?: string
          requirement_count?: number | null
          requirement_type?: string
          tier?: string | null
          xp_reward?: number | null
        }
        Relationships: []
      }
      ai_cache: {
        Row: {
          cache_key: string
          cache_type: string
          created_at: string
          expires_at: string | null
          id: string
          model_used: string | null
          response_data: Json
        }
        Insert: {
          cache_key: string
          cache_type: string
          created_at?: string
          expires_at?: string | null
          id?: string
          model_used?: string | null
          response_data: Json
        }
        Update: {
          cache_key?: string
          cache_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          model_used?: string | null
          response_data?: Json
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          cost_usd: number | null
          created_at: string
          function_name: string
          id: string
          input_tokens: number | null
          model_used: string
          output_tokens: number | null
          user_id: string
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          function_name: string
          id?: string
          input_tokens?: number | null
          model_used: string
          output_tokens?: number | null
          user_id: string
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          function_name?: string
          id?: string
          input_tokens?: number | null
          model_used?: string
          output_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      anti_recommendations: {
        Row: {
          action: string
          created_at: string
          dream_job_id: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          dream_job_id: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          dream_job_id?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anti_recommendations_dream_job_id_fkey"
            columns: ["dream_job_id"]
            isOneToOne: false
            referencedRelation: "dream_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      api_quota_tracking: {
        Row: {
          api_name: string
          created_at: string
          date: string
          id: string
          units_used: number
          updated_at: string
        }
        Insert: {
          api_name: string
          created_at?: string
          date?: string
          id?: string
          units_used?: number
          updated_at?: string
        }
        Update: {
          api_name?: string
          created_at?: string
          date?: string
          id?: string
          units_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      api_usage_tracking: {
        Row: {
          api_name: string
          created_at: string | null
          date: string
          id: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          api_name: string
          created_at?: string | null
          date?: string
          id?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          api_name?: string
          created_at?: string | null
          date?: string
          id?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      assessment_answers: {
        Row: {
          answer_submitted_at: string | null
          created_at: string | null
          evaluation_details: Json | null
          evaluation_method: string | null
          id: string
          is_correct: boolean | null
          question_id: string
          question_served_at: string | null
          server_received_at: string | null
          session_id: string
          time_taken_seconds: number | null
          user_answer: string | null
        }
        Insert: {
          answer_submitted_at?: string | null
          created_at?: string | null
          evaluation_details?: Json | null
          evaluation_method?: string | null
          id?: string
          is_correct?: boolean | null
          question_id: string
          question_served_at?: string | null
          server_received_at?: string | null
          session_id: string
          time_taken_seconds?: number | null
          user_answer?: string | null
        }
        Update: {
          answer_submitted_at?: string | null
          created_at?: string | null
          evaluation_details?: Json | null
          evaluation_method?: string | null
          id?: string
          is_correct?: boolean | null
          question_id?: string
          question_served_at?: string | null
          server_received_at?: string | null
          session_id?: string
          time_taken_seconds?: number | null
          user_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_item_bank: {
        Row: {
          created_at: string
          difficulty_level: string | null
          framework: string
          id: string
          is_quick_assessment: boolean | null
          is_reverse_scored: boolean | null
          measures_dimension: string
          question_text: string
          question_type: string
          response_options: Json | null
          sequence_order: number | null
        }
        Insert: {
          created_at?: string
          difficulty_level?: string | null
          framework: string
          id?: string
          is_quick_assessment?: boolean | null
          is_reverse_scored?: boolean | null
          measures_dimension: string
          question_text: string
          question_type?: string
          response_options?: Json | null
          sequence_order?: number | null
        }
        Update: {
          created_at?: string
          difficulty_level?: string | null
          framework?: string
          id?: string
          is_quick_assessment?: boolean | null
          is_reverse_scored?: boolean | null
          measures_dimension?: string
          question_text?: string
          question_type?: string
          response_options?: Json | null
          sequence_order?: number | null
        }
        Relationships: []
      }
      assessment_questions: {
        Row: {
          accepted_answers: string[] | null
          ai_reviewed: boolean | null
          bloom_level: string | null
          correct_answer: string | null
          created_at: string | null
          created_by: string | null
          difficulty: string | null
          has_image: boolean | null
          id: string
          image_url: string | null
          is_ai_generated: boolean | null
          learning_objective_id: string
          options: Json | null
          question_text: string
          question_type: string
          required_keywords: string[] | null
          scenario_context: string | null
          time_limit_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          accepted_answers?: string[] | null
          ai_reviewed?: boolean | null
          bloom_level?: string | null
          correct_answer?: string | null
          created_at?: string | null
          created_by?: string | null
          difficulty?: string | null
          has_image?: boolean | null
          id?: string
          image_url?: string | null
          is_ai_generated?: boolean | null
          learning_objective_id: string
          options?: Json | null
          question_text: string
          question_type: string
          required_keywords?: string[] | null
          scenario_context?: string | null
          time_limit_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          accepted_answers?: string[] | null
          ai_reviewed?: boolean | null
          bloom_level?: string | null
          correct_answer?: string | null
          created_at?: string | null
          created_by?: string | null
          difficulty?: string | null
          has_image?: boolean | null
          id?: string
          image_url?: string | null
          is_ai_generated?: boolean | null
          learning_objective_id?: string
          options?: Json | null
          question_text?: string
          question_type?: string
          required_keywords?: string[] | null
          scenario_context?: string | null
          time_limit_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_learning_objective_id_fkey"
            columns: ["learning_objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_sessions: {
        Row: {
          attempt_number: number | null
          completed_at: string | null
          current_question_index: number | null
          id: string
          learning_objective_id: string
          passed: boolean | null
          question_ids: string[]
          questions_answered: number | null
          questions_correct: number | null
          started_at: string | null
          status: string | null
          timeout_at: string | null
          total_score: number | null
          user_id: string
        }
        Insert: {
          attempt_number?: number | null
          completed_at?: string | null
          current_question_index?: number | null
          id?: string
          learning_objective_id: string
          passed?: boolean | null
          question_ids: string[]
          questions_answered?: number | null
          questions_correct?: number | null
          started_at?: string | null
          status?: string | null
          timeout_at?: string | null
          total_score?: number | null
          user_id: string
        }
        Update: {
          attempt_number?: number | null
          completed_at?: string | null
          current_question_index?: number | null
          id?: string
          learning_objective_id?: string
          passed?: boolean | null
          question_ids?: string[]
          questions_answered?: number | null
          questions_correct?: number | null
          started_at?: string | null
          status?: string | null
          timeout_at?: string | null
          total_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_learning_objective_id_fkey"
            columns: ["learning_objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          failed_count: number | null
          failed_request_keys: Json | null
          generation_cost_usd: number | null
          google_batch_id: string
          id: string
          instructor_course_id: string
          job_type: string
          output_uri: string | null
          provider: string | null
          request_mapping: Json
          research_data: Json | null
          status: string
          succeeded_count: number | null
          total_requests: number
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          failed_count?: number | null
          failed_request_keys?: Json | null
          generation_cost_usd?: number | null
          google_batch_id: string
          id?: string
          instructor_course_id: string
          job_type?: string
          output_uri?: string | null
          provider?: string | null
          request_mapping?: Json
          research_data?: Json | null
          status?: string
          succeeded_count?: number | null
          total_requests: number
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          failed_count?: number | null
          failed_request_keys?: Json | null
          generation_cost_usd?: number | null
          google_batch_id?: string
          id?: string
          instructor_course_id?: string
          job_type?: string
          output_uri?: string | null
          provider?: string | null
          request_mapping?: Json
          research_data?: Json | null
          status?: string
          succeeded_count?: number | null
          total_requests?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_jobs_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      capabilities: {
        Row: {
          category: string | null
          course_id: string | null
          created_at: string
          id: string
          name: string
          proficiency_level: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          name: string
          proficiency_level?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          course_id?: string | null
          created_at?: string
          id?: string
          name?: string
          proficiency_level?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capabilities_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      capability_profiles: {
        Row: {
          capabilities_by_theme: Json | null
          combined_capability_text: string | null
          course_count: number | null
          created_at: string
          id: string
          last_updated: string
          user_id: string
        }
        Insert: {
          capabilities_by_theme?: Json | null
          combined_capability_text?: string | null
          course_count?: number | null
          created_at?: string
          id?: string
          last_updated?: string
          user_id: string
        }
        Update: {
          capabilities_by_theme?: Json | null
          combined_capability_text?: string | null
          course_count?: number | null
          created_at?: string
          id?: string
          last_updated?: string
          user_id?: string
        }
        Relationships: []
      }
      capstone_applications: {
        Row: {
          capstone_project_id: string
          cover_letter: string | null
          created_at: string
          id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          capstone_project_id: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          capstone_project_id?: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capstone_applications_capstone_project_id_fkey"
            columns: ["capstone_project_id"]
            isOneToOne: false
            referencedRelation: "capstone_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      capstone_generation_runs: {
        Row: {
          companies_discovered: number | null
          companies_saved: number | null
          companies_validated: number | null
          completed_at: string | null
          created_at: string
          credits_used: number | null
          current_phase: string | null
          error_details: Json | null
          id: string
          instructor_course_id: string
          onet_data: Json | null
          phase_timings: Json | null
          phases_completed: string[] | null
          projects_generated: number | null
          signal_summary: Json | null
          started_by: string
          status: string
          total_processing_time_ms: number | null
          updated_at: string
        }
        Insert: {
          companies_discovered?: number | null
          companies_saved?: number | null
          companies_validated?: number | null
          completed_at?: string | null
          created_at?: string
          credits_used?: number | null
          current_phase?: string | null
          error_details?: Json | null
          id?: string
          instructor_course_id: string
          onet_data?: Json | null
          phase_timings?: Json | null
          phases_completed?: string[] | null
          projects_generated?: number | null
          signal_summary?: Json | null
          started_by: string
          status?: string
          total_processing_time_ms?: number | null
          updated_at?: string
        }
        Update: {
          companies_discovered?: number | null
          companies_saved?: number | null
          companies_validated?: number | null
          completed_at?: string | null
          created_at?: string
          credits_used?: number | null
          current_phase?: string | null
          error_details?: Json | null
          id?: string
          instructor_course_id?: string
          onet_data?: Json | null
          phase_timings?: Json | null
          phases_completed?: string[] | null
          projects_generated?: number | null
          signal_summary?: Json | null
          started_by?: string
          status?: string
          total_processing_time_ms?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capstone_generation_runs_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      capstone_projects: {
        Row: {
          algorithm_version: string | null
          assigned_student_id: string | null
          company_profile_id: string | null
          contact: Json | null
          created_at: string
          deliverables: Json | null
          description: string | null
          equipment: string | null
          feasibility_score: number | null
          final_score: number | null
          generation_batch_id: string | null
          generation_metadata: Json | null
          id: string
          instructor_course_id: string
          lo_alignment: string | null
          lo_alignment_score: number | null
          majors: string[] | null
          mutual_benefit_score: number | null
          pricing_usd: number | null
          skills: string[] | null
          status: string
          tasks: Json | null
          tier: string | null
          title: string
          updated_at: string
        }
        Insert: {
          algorithm_version?: string | null
          assigned_student_id?: string | null
          company_profile_id?: string | null
          contact?: Json | null
          created_at?: string
          deliverables?: Json | null
          description?: string | null
          equipment?: string | null
          feasibility_score?: number | null
          final_score?: number | null
          generation_batch_id?: string | null
          generation_metadata?: Json | null
          id?: string
          instructor_course_id: string
          lo_alignment?: string | null
          lo_alignment_score?: number | null
          majors?: string[] | null
          mutual_benefit_score?: number | null
          pricing_usd?: number | null
          skills?: string[] | null
          status?: string
          tasks?: Json | null
          tier?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          algorithm_version?: string | null
          assigned_student_id?: string | null
          company_profile_id?: string | null
          contact?: Json | null
          created_at?: string
          deliverables?: Json | null
          description?: string | null
          equipment?: string | null
          feasibility_score?: number | null
          final_score?: number | null
          generation_batch_id?: string | null
          generation_metadata?: Json | null
          id?: string
          instructor_course_id?: string
          lo_alignment?: string | null
          lo_alignment_score?: number | null
          majors?: string[] | null
          mutual_benefit_score?: number | null
          pricing_usd?: number | null
          skills?: string[] | null
          status?: string
          tasks?: Json | null
          tier?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capstone_projects_company_profile_id_fkey"
            columns: ["company_profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capstone_projects_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      career_matches: {
        Row: {
          created_at: string
          dream_job_id: string | null
          id: string
          interest_match_score: number | null
          is_dismissed: boolean | null
          is_saved: boolean | null
          match_breakdown: Json | null
          occupation_title: string
          onet_soc_code: string
          overall_match_score: number
          skill_gaps: Json | null
          skill_match_score: number | null
          skill_profile_id: string | null
          updated_at: string
          user_id: string
          values_match_score: number | null
        }
        Insert: {
          created_at?: string
          dream_job_id?: string | null
          id?: string
          interest_match_score?: number | null
          is_dismissed?: boolean | null
          is_saved?: boolean | null
          match_breakdown?: Json | null
          occupation_title: string
          onet_soc_code: string
          overall_match_score: number
          skill_gaps?: Json | null
          skill_match_score?: number | null
          skill_profile_id?: string | null
          updated_at?: string
          user_id: string
          values_match_score?: number | null
        }
        Update: {
          created_at?: string
          dream_job_id?: string | null
          id?: string
          interest_match_score?: number | null
          is_dismissed?: boolean | null
          is_saved?: boolean | null
          match_breakdown?: Json | null
          occupation_title?: string
          onet_soc_code?: string
          overall_match_score?: number
          skill_gaps?: Json | null
          skill_match_score?: number | null
          skill_profile_id?: string | null
          updated_at?: string
          user_id?: string
          values_match_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "career_matches_dream_job_id_fkey"
            columns: ["dream_job_id"]
            isOneToOne: false
            referencedRelation: "dream_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_matches_skill_profile_id_fkey"
            columns: ["skill_profile_id"]
            isOneToOne: false
            referencedRelation: "skill_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_verifications: {
        Row: {
          certificate_id: string
          employer_account_id: string | null
          id: string
          verified_at: string | null
          verified_via: string
          verifier_ip: unknown
          verifier_user_agent: string | null
        }
        Insert: {
          certificate_id: string
          employer_account_id?: string | null
          id?: string
          verified_at?: string | null
          verified_via: string
          verifier_ip?: unknown
          verifier_user_agent?: string | null
        }
        Update: {
          certificate_id?: string
          employer_account_id?: string | null
          id?: string
          verified_at?: string | null
          verified_via?: string
          verifier_ip?: unknown
          verifier_user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificate_verifications_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_verifications_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates_public_verify"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          amount_paid_cents: number | null
          certificate_number: string
          certificate_type: string
          completion_date: string
          course_title: string
          created_at: string | null
          enrollment_id: string
          id: string
          identity_verified: boolean | null
          institution_name: string | null
          instructor_course_id: string
          instructor_name: string | null
          instructor_verified: boolean | null
          issued_at: string | null
          mastery_score: number | null
          pdf_path: string | null
          qr_code_data: string | null
          share_token: string
          skill_breakdown: Json | null
          status: string | null
          stripe_payment_intent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_paid_cents?: number | null
          certificate_number: string
          certificate_type: string
          completion_date?: string
          course_title: string
          created_at?: string | null
          enrollment_id: string
          id?: string
          identity_verified?: boolean | null
          institution_name?: string | null
          instructor_course_id: string
          instructor_name?: string | null
          instructor_verified?: boolean | null
          issued_at?: string | null
          mastery_score?: number | null
          pdf_path?: string | null
          qr_code_data?: string | null
          share_token: string
          skill_breakdown?: Json | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_paid_cents?: number | null
          certificate_number?: string
          certificate_type?: string
          completion_date?: string
          course_title?: string
          created_at?: string | null
          enrollment_id?: string
          id?: string
          identity_verified?: boolean | null
          institution_name?: string | null
          instructor_course_id?: string
          instructor_name?: string | null
          instructor_verified?: boolean | null
          issued_at?: string | null
          mastery_score?: number | null
          pdf_path?: string | null
          qr_code_data?: string | null
          share_token?: string
          skill_breakdown?: Json | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_answers: {
        Row: {
          answered_at: string
          challenge_id: string
          id: string
          is_correct: boolean
          question_id: string
          time_taken_seconds: number | null
          user_answer: string
          user_id: string
        }
        Insert: {
          answered_at?: string
          challenge_id: string
          id?: string
          is_correct: boolean
          question_id: string
          time_taken_seconds?: number | null
          user_answer: string
          user_id: string
        }
        Update: {
          answered_at?: string
          challenge_id?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          time_taken_seconds?: number | null
          user_answer?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_answers_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "quiz_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      community_explanations: {
        Row: {
          course_id: string
          created_at: string
          explanation_text: string
          id: string
          question_id: string
          updated_at: string
          user_id: string
          votes: number
        }
        Insert: {
          course_id: string
          created_at?: string
          explanation_text: string
          id?: string
          question_id: string
          updated_at?: string
          user_id: string
          votes?: number
        }
        Update: {
          course_id?: string
          created_at?: string
          explanation_text?: string
          id?: string
          question_id?: string
          updated_at?: string
          user_id?: string
          votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_explanations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_explanations_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profiles: {
        Row: {
          apollo_organization_id: string | null
          buying_intent_signals: Json | null
          city: string | null
          composite_signal_score: number | null
          contact_city: string | null
          contact_country: string | null
          contact_email: string | null
          contact_email_status: string | null
          contact_employment_history: Json | null
          contact_first_name: string | null
          contact_headline: string | null
          contact_last_name: string | null
          contact_person: string | null
          contact_phone: string | null
          contact_phone_numbers: Json | null
          contact_photo_url: string | null
          contact_quality_score: number | null
          contact_state: string | null
          contact_title: string | null
          contact_twitter_url: string | null
          country: string | null
          created_at: string
          data_completeness_score: number | null
          data_enrichment_level: string | null
          department_fit_score: number | null
          departmental_head_count: Json | null
          description: string | null
          discovery_source: string | null
          employee_count: string | null
          full_address: string | null
          funding_events: Json | null
          funding_stage: string | null
          generation_run_id: string | null
          id: string
          industries: string[] | null
          inferred_needs: string[] | null
          instructor_course_id: string | null
          job_postings: Json | null
          keywords: string[] | null
          last_enriched_at: string | null
          linkedin_profile: string | null
          market_signal_score: number | null
          match_confidence: string | null
          match_reason: string | null
          match_score: number | null
          matching_skills: string[] | null
          name: string
          organization_facebook_url: string | null
          organization_founded_year: number | null
          organization_industry_keywords: string[] | null
          organization_linkedin_url: string | null
          organization_logo_url: string | null
          organization_revenue_range: string | null
          organization_twitter_url: string | null
          revenue_range: string | null
          sector: string | null
          seo_description: string | null
          signal_confidence: string | null
          signal_data: Json | null
          similarity_score: number | null
          size: string | null
          skill_match_score: number | null
          state: string | null
          technologies_used: string[] | null
          total_funding_usd: number | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          apollo_organization_id?: string | null
          buying_intent_signals?: Json | null
          city?: string | null
          composite_signal_score?: number | null
          contact_city?: string | null
          contact_country?: string | null
          contact_email?: string | null
          contact_email_status?: string | null
          contact_employment_history?: Json | null
          contact_first_name?: string | null
          contact_headline?: string | null
          contact_last_name?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contact_phone_numbers?: Json | null
          contact_photo_url?: string | null
          contact_quality_score?: number | null
          contact_state?: string | null
          contact_title?: string | null
          contact_twitter_url?: string | null
          country?: string | null
          created_at?: string
          data_completeness_score?: number | null
          data_enrichment_level?: string | null
          department_fit_score?: number | null
          departmental_head_count?: Json | null
          description?: string | null
          discovery_source?: string | null
          employee_count?: string | null
          full_address?: string | null
          funding_events?: Json | null
          funding_stage?: string | null
          generation_run_id?: string | null
          id?: string
          industries?: string[] | null
          inferred_needs?: string[] | null
          instructor_course_id?: string | null
          job_postings?: Json | null
          keywords?: string[] | null
          last_enriched_at?: string | null
          linkedin_profile?: string | null
          market_signal_score?: number | null
          match_confidence?: string | null
          match_reason?: string | null
          match_score?: number | null
          matching_skills?: string[] | null
          name: string
          organization_facebook_url?: string | null
          organization_founded_year?: number | null
          organization_industry_keywords?: string[] | null
          organization_linkedin_url?: string | null
          organization_logo_url?: string | null
          organization_revenue_range?: string | null
          organization_twitter_url?: string | null
          revenue_range?: string | null
          sector?: string | null
          seo_description?: string | null
          signal_confidence?: string | null
          signal_data?: Json | null
          similarity_score?: number | null
          size?: string | null
          skill_match_score?: number | null
          state?: string | null
          technologies_used?: string[] | null
          total_funding_usd?: number | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          apollo_organization_id?: string | null
          buying_intent_signals?: Json | null
          city?: string | null
          composite_signal_score?: number | null
          contact_city?: string | null
          contact_country?: string | null
          contact_email?: string | null
          contact_email_status?: string | null
          contact_employment_history?: Json | null
          contact_first_name?: string | null
          contact_headline?: string | null
          contact_last_name?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contact_phone_numbers?: Json | null
          contact_photo_url?: string | null
          contact_quality_score?: number | null
          contact_state?: string | null
          contact_title?: string | null
          contact_twitter_url?: string | null
          country?: string | null
          created_at?: string
          data_completeness_score?: number | null
          data_enrichment_level?: string | null
          department_fit_score?: number | null
          departmental_head_count?: Json | null
          description?: string | null
          discovery_source?: string | null
          employee_count?: string | null
          full_address?: string | null
          funding_events?: Json | null
          funding_stage?: string | null
          generation_run_id?: string | null
          id?: string
          industries?: string[] | null
          inferred_needs?: string[] | null
          instructor_course_id?: string | null
          job_postings?: Json | null
          keywords?: string[] | null
          last_enriched_at?: string | null
          linkedin_profile?: string | null
          market_signal_score?: number | null
          match_confidence?: string | null
          match_reason?: string | null
          match_score?: number | null
          matching_skills?: string[] | null
          name?: string
          organization_facebook_url?: string | null
          organization_founded_year?: number | null
          organization_industry_keywords?: string[] | null
          organization_linkedin_url?: string | null
          organization_logo_url?: string | null
          organization_revenue_range?: string | null
          organization_twitter_url?: string | null
          revenue_range?: string | null
          sector?: string | null
          seo_description?: string | null
          signal_confidence?: string | null
          signal_data?: Json | null
          similarity_score?: number | null
          size?: string | null
          skill_match_score?: number | null
          state?: string | null
          technologies_used?: string[] | null
          total_funding_usd?: number | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_profiles_generation_run_id_fkey"
            columns: ["generation_run_id"]
            isOneToOne: false
            referencedRelation: "capstone_generation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_profiles_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      consumption_records: {
        Row: {
          completed_at: string | null
          content_id: string
          created_at: string | null
          current_position_seconds: number | null
          engagement_score: number | null
          id: string
          interaction_signals_score: number | null
          is_verified: boolean | null
          learning_objective_id: string | null
          micro_check_accuracy_score: number | null
          playback_speed_violations: number | null
          rewind_events: Json | null
          started_at: string | null
          tab_focus_losses: Json | null
          time_on_content_score: number | null
          total_watch_time_seconds: number | null
          updated_at: string | null
          user_id: string
          watch_percentage: number | null
          watched_segments: Json | null
        }
        Insert: {
          completed_at?: string | null
          content_id: string
          created_at?: string | null
          current_position_seconds?: number | null
          engagement_score?: number | null
          id?: string
          interaction_signals_score?: number | null
          is_verified?: boolean | null
          learning_objective_id?: string | null
          micro_check_accuracy_score?: number | null
          playback_speed_violations?: number | null
          rewind_events?: Json | null
          started_at?: string | null
          tab_focus_losses?: Json | null
          time_on_content_score?: number | null
          total_watch_time_seconds?: number | null
          updated_at?: string | null
          user_id: string
          watch_percentage?: number | null
          watched_segments?: Json | null
        }
        Update: {
          completed_at?: string | null
          content_id?: string
          created_at?: string | null
          current_position_seconds?: number | null
          engagement_score?: number | null
          id?: string
          interaction_signals_score?: number | null
          is_verified?: boolean | null
          learning_objective_id?: string | null
          micro_check_accuracy_score?: number | null
          playback_speed_violations?: number | null
          rewind_events?: Json | null
          started_at?: string | null
          tab_focus_losses?: Json | null
          time_on_content_score?: number | null
          total_watch_time_seconds?: number | null
          updated_at?: string | null
          user_id?: string
          watch_percentage?: number | null
          watched_segments?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "consumption_records_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumption_records_learning_objective_id_fkey"
            columns: ["learning_objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      content: {
        Row: {
          average_rating: number | null
          channel_id: string | null
          channel_name: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty_distribution: Json | null
          duration_seconds: number | null
          id: string
          is_available: boolean | null
          last_availability_check: string | null
          like_count: number | null
          like_ratio: number | null
          published_at: string | null
          quality_score: number | null
          rating_count: number | null
          source_id: string | null
          source_type: string
          source_url: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          average_rating?: number | null
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty_distribution?: Json | null
          duration_seconds?: number | null
          id?: string
          is_available?: boolean | null
          last_availability_check?: string | null
          like_count?: number | null
          like_ratio?: number | null
          published_at?: string | null
          quality_score?: number | null
          rating_count?: number | null
          source_id?: string | null
          source_type: string
          source_url?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          average_rating?: number | null
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty_distribution?: Json | null
          duration_seconds?: number | null
          id?: string
          is_available?: boolean | null
          last_availability_check?: string | null
          like_count?: number | null
          like_ratio?: number | null
          published_at?: string | null
          quality_score?: number | null
          rating_count?: number | null
          source_id?: string | null
          source_type?: string
          source_url?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      content_assistant_chats: {
        Row: {
          created_at: string | null
          id: string
          learning_objective_id: string | null
          messages: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          learning_objective_id?: string | null
          messages?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          learning_objective_id?: string | null
          messages?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_assistant_chats_learning_objective_id_fkey"
            columns: ["learning_objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      content_matches: {
        Row: {
          ai_concern: string | null
          ai_pedagogy_score: number | null
          ai_quality_score: number | null
          ai_reasoning: string | null
          ai_recommendation: string | null
          ai_relevance_score: number | null
          approved_at: string | null
          approved_by: string | null
          channel_authority_score: number | null
          content_id: string
          content_role: string | null
          created_at: string | null
          duration_fit_score: number | null
          engagement_quality_score: number | null
          id: string
          learning_objective_id: string
          match_score: number
          recency_score: number | null
          rejection_reason: string | null
          semantic_similarity_score: number | null
          status: string | null
          teaching_unit_id: string | null
        }
        Insert: {
          ai_concern?: string | null
          ai_pedagogy_score?: number | null
          ai_quality_score?: number | null
          ai_reasoning?: string | null
          ai_recommendation?: string | null
          ai_relevance_score?: number | null
          approved_at?: string | null
          approved_by?: string | null
          channel_authority_score?: number | null
          content_id: string
          content_role?: string | null
          created_at?: string | null
          duration_fit_score?: number | null
          engagement_quality_score?: number | null
          id?: string
          learning_objective_id: string
          match_score: number
          recency_score?: number | null
          rejection_reason?: string | null
          semantic_similarity_score?: number | null
          status?: string | null
          teaching_unit_id?: string | null
        }
        Update: {
          ai_concern?: string | null
          ai_pedagogy_score?: number | null
          ai_quality_score?: number | null
          ai_reasoning?: string | null
          ai_recommendation?: string | null
          ai_relevance_score?: number | null
          approved_at?: string | null
          approved_by?: string | null
          channel_authority_score?: number | null
          content_id?: string
          content_role?: string | null
          created_at?: string | null
          duration_fit_score?: number | null
          engagement_quality_score?: number | null
          id?: string
          learning_objective_id?: string
          match_score?: number
          recency_score?: number | null
          rejection_reason?: string | null
          semantic_similarity_score?: number | null
          status?: string | null
          teaching_unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_matches_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_matches_learning_objective_id_fkey"
            columns: ["learning_objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_matches_teaching_unit_id_fkey"
            columns: ["teaching_unit_id"]
            isOneToOne: false
            referencedRelation: "teaching_units"
            referencedColumns: ["id"]
          },
        ]
      }
      content_moderation: {
        Row: {
          action_taken: string | null
          content_id: string
          content_type: string
          course_id: string | null
          created_at: string | null
          details: Json | null
          flagged_by: string | null
          id: string
          reason: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          action_taken?: string | null
          content_id: string
          content_type: string
          course_id?: string | null
          created_at?: string | null
          details?: Json | null
          flagged_by?: string | null
          id?: string
          reason: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          action_taken?: string | null
          content_id?: string
          content_type?: string
          course_id?: string | null
          created_at?: string | null
          details?: Json | null
          flagged_by?: string | null
          id?: string
          reason?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_moderation_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ratings: {
        Row: {
          comment: string | null
          content_id: string
          created_at: string | null
          difficulty: string | null
          helpful: boolean | null
          id: string
          rating: number
          updated_at: string | null
          user_id: string
          watch_percentage: number | null
        }
        Insert: {
          comment?: string | null
          content_id: string
          created_at?: string | null
          difficulty?: string | null
          helpful?: boolean | null
          id?: string
          rating: number
          updated_at?: string | null
          user_id: string
          watch_percentage?: number | null
        }
        Update: {
          comment?: string | null
          content_id?: string
          created_at?: string | null
          difficulty?: string | null
          helpful?: boolean | null
          id?: string
          rating?: number
          updated_at?: string | null
          user_id?: string
          watch_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_ratings_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      content_search_cache: {
        Row: {
          created_at: string
          expires_at: string
          hit_count: number
          id: string
          results: Json
          search_concept: string
          search_keywords: string[]
          source: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          results?: Json
          search_concept: string
          search_keywords?: string[]
          source?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          results?: Json
          search_concept?: string
          search_keywords?: string[]
          source?: string
        }
        Relationships: []
      }
      content_search_strategies: {
        Row: {
          created_at: string | null
          expected_video_type: string | null
          id: string
          learning_objective_id: string | null
          priority: number | null
          query: string
          rationale: string | null
          videos_found: number | null
        }
        Insert: {
          created_at?: string | null
          expected_video_type?: string | null
          id?: string
          learning_objective_id?: string | null
          priority?: number | null
          query: string
          rationale?: string | null
          videos_found?: number | null
        }
        Update: {
          created_at?: string | null
          expected_video_type?: string | null
          id?: string
          learning_objective_id?: string | null
          priority?: number | null
          query?: string
          rationale?: string | null
          videos_found?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_search_strategies_learning_objective_id_fkey"
            columns: ["learning_objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      content_suggestions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          learning_objective_id: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          source_type: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          url: string
          user_id: string
          votes: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          learning_objective_id: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          source_type?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          url: string
          user_id: string
          votes?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          learning_objective_id?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          source_type?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          url?: string
          user_id?: string
          votes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_suggestions_learning_objective_id_fkey"
            columns: ["learning_objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      course_creation_costs: {
        Row: {
          ai_model_used: string | null
          cost_usd: number
          created_at: string | null
          id: string
          instructor_course_id: string
          stage: string
          tokens_used: number | null
        }
        Insert: {
          ai_model_used?: string | null
          cost_usd?: number
          created_at?: string | null
          id?: string
          instructor_course_id: string
          stage: string
          tokens_used?: number | null
        }
        Update: {
          ai_model_used?: string | null
          cost_usd?: number
          created_at?: string | null
          id?: string
          instructor_course_id?: string
          stage?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "course_creation_costs_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          certificate_eligible: boolean | null
          certificate_id: string | null
          completed_at: string | null
          enrolled_at: string | null
          id: string
          instructor_course_id: string
          overall_progress: number | null
          student_id: string
        }
        Insert: {
          certificate_eligible?: boolean | null
          certificate_id?: string | null
          completed_at?: string | null
          enrolled_at?: string | null
          id?: string
          instructor_course_id: string
          overall_progress?: number | null
          student_id: string
        }
        Update: {
          certificate_eligible?: boolean | null
          certificate_id?: string | null
          completed_at?: string | null
          enrolled_at?: string | null
          id?: string
          instructor_course_id?: string
          overall_progress?: number | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates_public_verify"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_terms: {
        Row: {
          created_at: string | null
          domain: string
          frequency: number | null
          id: string
          instructor_course_id: string
          term: string
        }
        Insert: {
          created_at?: string | null
          domain?: string
          frequency?: number | null
          id?: string
          instructor_course_id: string
          term: string
        }
        Update: {
          created_at?: string | null
          domain?: string
          frequency?: number | null
          id?: string
          instructor_course_id?: string
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_terms_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          ai_cost_usd: number | null
          ai_model_used: string | null
          analysis_error: string | null
          analysis_status: string | null
          capability_keywords: string[] | null
          capability_text: string | null
          code: string | null
          created_at: string
          credits: number | null
          evidence_types: Json | null
          grade: string | null
          id: string
          instructor: string | null
          key_capabilities: Json | null
          semester: string | null
          syllabus_url: string | null
          title: string
          tools_methods: Json | null
          updated_at: string
          user_id: string
          year: number | null
        }
        Insert: {
          ai_cost_usd?: number | null
          ai_model_used?: string | null
          analysis_error?: string | null
          analysis_status?: string | null
          capability_keywords?: string[] | null
          capability_text?: string | null
          code?: string | null
          created_at?: string
          credits?: number | null
          evidence_types?: Json | null
          grade?: string | null
          id?: string
          instructor?: string | null
          key_capabilities?: Json | null
          semester?: string | null
          syllabus_url?: string | null
          title: string
          tools_methods?: Json | null
          updated_at?: string
          user_id: string
          year?: number | null
        }
        Update: {
          ai_cost_usd?: number | null
          ai_model_used?: string | null
          analysis_error?: string | null
          analysis_status?: string | null
          capability_keywords?: string[] | null
          capability_text?: string | null
          code?: string | null
          created_at?: string
          credits?: number | null
          evidence_types?: Json | null
          grade?: string | null
          id?: string
          instructor?: string | null
          key_capabilities?: Json | null
          semester?: string | null
          syllabus_url?: string | null
          title?: string
          tools_methods?: Json | null
          updated_at?: string
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      discovered_careers: {
        Row: {
          company_types: Json | null
          created_at: string
          day_in_life: string | null
          description: string | null
          discovery_input: Json | null
          growth_outlook: string | null
          id: string
          is_added_to_dream_jobs: boolean | null
          key_skills: Json | null
          salary_range: string | null
          title: string
          user_id: string
          why_it_fits: string | null
        }
        Insert: {
          company_types?: Json | null
          created_at?: string
          day_in_life?: string | null
          description?: string | null
          discovery_input?: Json | null
          growth_outlook?: string | null
          id?: string
          is_added_to_dream_jobs?: boolean | null
          key_skills?: Json | null
          salary_range?: string | null
          title: string
          user_id: string
          why_it_fits?: string | null
        }
        Update: {
          company_types?: Json | null
          created_at?: string
          day_in_life?: string | null
          description?: string | null
          discovery_input?: Json | null
          growth_outlook?: string | null
          id?: string
          is_added_to_dream_jobs?: boolean | null
          key_skills?: Json | null
          salary_range?: string | null
          title?: string
          user_id?: string
          why_it_fits?: string | null
        }
        Relationships: []
      }
      dream_jobs: {
        Row: {
          common_misconceptions: Json | null
          company_type: string | null
          created_at: string
          day_one_capabilities: Json | null
          description: string | null
          differentiators: Json | null
          id: string
          is_primary: boolean | null
          location: string | null
          match_score: number | null
          realistic_bar: string | null
          requirements_keywords: string[] | null
          salary_range: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          common_misconceptions?: Json | null
          company_type?: string | null
          created_at?: string
          day_one_capabilities?: Json | null
          description?: string | null
          differentiators?: Json | null
          id?: string
          is_primary?: boolean | null
          location?: string | null
          match_score?: number | null
          realistic_bar?: string | null
          requirements_keywords?: string[] | null
          salary_range?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          common_misconceptions?: Json | null
          company_type?: string | null
          created_at?: string
          day_one_capabilities?: Json | null
          description?: string | null
          differentiators?: Json | null
          id?: string
          is_primary?: boolean | null
          location?: string | null
          match_score?: number | null
          realistic_bar?: string | null
          requirements_keywords?: string[] | null
          salary_range?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employer_accounts: {
        Row: {
          company_domain: string | null
          company_name: string
          created_at: string | null
          id: string
          is_active: boolean | null
          monthly_verification_limit: number | null
          plan: string | null
          primary_contact_email: string | null
          primary_contact_user_id: string | null
          stripe_customer_id: string | null
          updated_at: string | null
          verifications_reset_at: string | null
          verifications_this_month: number | null
        }
        Insert: {
          company_domain?: string | null
          company_name: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          monthly_verification_limit?: number | null
          plan?: string | null
          primary_contact_email?: string | null
          primary_contact_user_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          verifications_reset_at?: string | null
          verifications_this_month?: number | null
        }
        Update: {
          company_domain?: string | null
          company_name?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          monthly_verification_limit?: number | null
          plan?: string | null
          primary_contact_email?: string | null
          primary_contact_user_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
          verifications_reset_at?: string | null
          verifications_this_month?: number | null
        }
        Relationships: []
      }
      employer_api_keys: {
        Row: {
          created_at: string | null
          employer_account_id: string
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string | null
          last_used_at: string | null
          name: string | null
          permissions: string[] | null
          request_count: number | null
        }
        Insert: {
          created_at?: string | null
          employer_account_id: string
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix?: string | null
          last_used_at?: string | null
          name?: string | null
          permissions?: string[] | null
          request_count?: number | null
        }
        Update: {
          created_at?: string | null
          employer_account_id?: string
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string | null
          last_used_at?: string | null
          name?: string | null
          permissions?: string[] | null
          request_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employer_api_keys_employer_account_id_fkey"
            columns: ["employer_account_id"]
            isOneToOne: false
            referencedRelation: "employer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_api_requests: {
        Row: {
          api_key_id: string
          created_at: string | null
          endpoint: string | null
          id: string
          request_ip: unknown
          request_method: string | null
          response_status: number | null
          response_time_ms: number | null
        }
        Insert: {
          api_key_id: string
          created_at?: string | null
          endpoint?: string | null
          id?: string
          request_ip?: unknown
          request_method?: string | null
          response_status?: number | null
          response_time_ms?: number | null
        }
        Update: {
          api_key_id?: string
          created_at?: string | null
          endpoint?: string | null
          id?: string
          request_ip?: unknown
          request_method?: string | null
          response_status?: number | null
          response_time_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employer_api_requests_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "employer_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_interest_submissions: {
        Row: {
          company_name: string
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          id: string
          notes: string | null
          preferred_timeline: string | null
          project_description: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string | null
          target_skills: string[] | null
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          preferred_timeline?: string | null
          project_description?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          target_skills?: string[] | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          preferred_timeline?: string | null
          project_description?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          target_skills?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      employer_webhooks: {
        Row: {
          created_at: string | null
          employer_account_id: string
          events: string[] | null
          failure_count: number | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          secret: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          employer_account_id: string
          events?: string[] | null
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          secret?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          employer_account_id?: string
          events?: string[] | null
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          secret?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_webhooks_employer_account_id_fkey"
            columns: ["employer_account_id"]
            isOneToOne: false
            referencedRelation: "employer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_transactions: {
        Row: {
          amount_cents: number
          completed_at: string | null
          created_at: string | null
          currency: string | null
          enrollment_id: string
          id: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          enrollment_id: string
          id?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          enrollment_id?: string
          id?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_transactions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          areas_for_improvement: string[] | null
          capstone_project_id: string
          comments: string | null
          created_at: string
          evaluator_id: string
          evaluator_role: string
          id: string
          overall_score: number | null
          recommendation: string | null
          rubric_scores: Json | null
          status: string
          strengths: string[] | null
          student_id: string | null
          updated_at: string | null
          verified_skills: string[] | null
        }
        Insert: {
          areas_for_improvement?: string[] | null
          capstone_project_id: string
          comments?: string | null
          created_at?: string
          evaluator_id: string
          evaluator_role: string
          id?: string
          overall_score?: number | null
          recommendation?: string | null
          rubric_scores?: Json | null
          status?: string
          strengths?: string[] | null
          student_id?: string | null
          updated_at?: string | null
          verified_skills?: string[] | null
        }
        Update: {
          areas_for_improvement?: string[] | null
          capstone_project_id?: string
          comments?: string | null
          created_at?: string
          evaluator_id?: string
          evaluator_role?: string
          id?: string
          overall_score?: number | null
          recommendation?: string | null
          rubric_scores?: Json | null
          status?: string
          strengths?: string[] | null
          student_id?: string | null
          updated_at?: string | null
          verified_skills?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_capstone_project_id_fkey"
            columns: ["capstone_project_id"]
            isOneToOne: false
            referencedRelation: "capstone_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      explanation_votes: {
        Row: {
          created_at: string
          explanation_id: string
          id: string
          user_id: string
          vote: number
        }
        Insert: {
          created_at?: string
          explanation_id: string
          id?: string
          user_id: string
          vote: number
        }
        Update: {
          created_at?: string
          explanation_id?: string
          id?: string
          user_id?: string
          vote?: number
        }
        Relationships: [
          {
            foreignKeyName: "explanation_votes_explanation_id_fkey"
            columns: ["explanation_id"]
            isOneToOne: false
            referencedRelation: "community_explanations"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_analyses: {
        Row: {
          ai_cost_usd: number | null
          ai_model_used: string | null
          analysis_text: string | null
          created_at: string
          critical_gaps: Json | null
          dream_job_id: string
          honest_assessment: string | null
          id: string
          interview_readiness: string | null
          job_success_prediction: string | null
          match_score: number | null
          partial_overlaps: Json | null
          priority_gaps: Json | null
          readiness_level: string | null
          strong_overlaps: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_cost_usd?: number | null
          ai_model_used?: string | null
          analysis_text?: string | null
          created_at?: string
          critical_gaps?: Json | null
          dream_job_id: string
          honest_assessment?: string | null
          id?: string
          interview_readiness?: string | null
          job_success_prediction?: string | null
          match_score?: number | null
          partial_overlaps?: Json | null
          priority_gaps?: Json | null
          readiness_level?: string | null
          strong_overlaps?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_cost_usd?: number | null
          ai_model_used?: string | null
          analysis_text?: string | null
          created_at?: string
          critical_gaps?: Json | null
          dream_job_id?: string
          honest_assessment?: string | null
          id?: string
          interview_readiness?: string | null
          job_success_prediction?: string | null
          match_score?: number | null
          partial_overlaps?: Json | null
          priority_gaps?: Json | null
          readiness_level?: string | null
          strong_overlaps?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gap_analyses_dream_job_id_fkey"
            columns: ["dream_job_id"]
            isOneToOne: false
            referencedRelation: "dream_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_curricula: {
        Row: {
          career_match_id: string | null
          completed_at: string | null
          created_at: string
          curriculum_structure: Json
          estimated_weeks: number | null
          generation_model: string | null
          generation_prompt_hash: string | null
          id: string
          progress_percentage: number | null
          started_at: string | null
          status: string | null
          target_occupation: string
          total_learning_objectives: number | null
          total_modules: number | null
          total_subjects: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          career_match_id?: string | null
          completed_at?: string | null
          created_at?: string
          curriculum_structure?: Json
          estimated_weeks?: number | null
          generation_model?: string | null
          generation_prompt_hash?: string | null
          id?: string
          progress_percentage?: number | null
          started_at?: string | null
          status?: string | null
          target_occupation: string
          total_learning_objectives?: number | null
          total_modules?: number | null
          total_subjects?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          career_match_id?: string | null
          completed_at?: string | null
          created_at?: string
          curriculum_structure?: Json
          estimated_weeks?: number | null
          generation_model?: string | null
          generation_prompt_hash?: string | null
          id?: string
          progress_percentage?: number | null
          started_at?: string | null
          status?: string | null
          target_occupation?: string
          total_learning_objectives?: number | null
          total_modules?: number | null
          total_subjects?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_curricula_career_match_id_fkey"
            columns: ["career_match_id"]
            isOneToOne: false
            referencedRelation: "career_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_trigger_checks: {
        Row: {
          batch_job_id: string | null
          checked_at: string | null
          enrollment_count: number
          id: string
          teaching_unit_id: string
          threshold: number
          trigger_id: string | null
          triggered: boolean | null
        }
        Insert: {
          batch_job_id?: string | null
          checked_at?: string | null
          enrollment_count: number
          id?: string
          teaching_unit_id: string
          threshold: number
          trigger_id?: string | null
          triggered?: boolean | null
        }
        Update: {
          batch_job_id?: string | null
          checked_at?: string | null
          enrollment_count?: number
          id?: string
          teaching_unit_id?: string
          threshold?: number
          trigger_id?: string | null
          triggered?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_trigger_checks_batch_job_id_fkey"
            columns: ["batch_job_id"]
            isOneToOne: false
            referencedRelation: "batch_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_trigger_checks_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "generation_triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_triggers: {
        Row: {
          batch_job_id: string | null
          created_at: string | null
          enrollment_count: number | null
          enrollment_threshold: number | null
          id: string
          instructor_course_id: string
          is_triggered: boolean | null
          learning_objective_id: string | null
          teaching_unit_id: string | null
          trigger_type: string
          triggered_at: string | null
          updated_at: string | null
        }
        Insert: {
          batch_job_id?: string | null
          created_at?: string | null
          enrollment_count?: number | null
          enrollment_threshold?: number | null
          id?: string
          instructor_course_id: string
          is_triggered?: boolean | null
          learning_objective_id?: string | null
          teaching_unit_id?: string | null
          trigger_type?: string
          triggered_at?: string | null
          updated_at?: string | null
        }
        Update: {
          batch_job_id?: string | null
          created_at?: string | null
          enrollment_count?: number | null
          enrollment_threshold?: number | null
          id?: string
          instructor_course_id?: string
          is_triggered?: boolean | null
          learning_objective_id?: string | null
          teaching_unit_id?: string | null
          trigger_type?: string
          triggered_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_triggers_batch_job_id_fkey"
            columns: ["batch_job_id"]
            isOneToOne: false
            referencedRelation: "batch_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_triggers_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_triggers_learning_objective_id_fkey"
            columns: ["learning_objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_triggers_teaching_unit_id_fkey"
            columns: ["teaching_unit_id"]
            isOneToOne: false
            referencedRelation: "teaching_units"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verifications: {
        Row: {
          completed_at: string | null
          cost_usd: number | null
          created_at: string | null
          document_country: string | null
          document_type: string | null
          expires_at: string | null
          failure_reason: string | null
          id: string
          liveness_check_passed: boolean | null
          provider: string
          provider_inquiry_id: string | null
          provider_session_token: string | null
          selfie_match_score: number | null
          status: string
          updated_at: string | null
          user_id: string
          verified_date_of_birth: string | null
          verified_full_name: string | null
          webhook_received_at: string | null
        }
        Insert: {
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string | null
          document_country?: string | null
          document_type?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          id?: string
          liveness_check_passed?: boolean | null
          provider?: string
          provider_inquiry_id?: string | null
          provider_session_token?: string | null
          selfie_match_score?: number | null
          status?: string
          updated_at?: string | null
          user_id: string
          verified_date_of_birth?: string | null
          verified_full_name?: string | null
          webhook_received_at?: string | null
        }
        Update: {
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string | null
          document_country?: string | null
          document_type?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          id?: string
          liveness_check_passed?: boolean | null
          provider?: string
          provider_inquiry_id?: string | null
          provider_session_token?: string | null
          selfie_match_score?: number | null
          status?: string
          updated_at?: string | null
          user_id?: string
          verified_date_of_birth?: string | null
          verified_full_name?: string | null
          webhook_received_at?: string | null
        }
        Relationships: []
      }
      image_generation_queue: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          generation_model: string | null
          id: string
          image_url: string | null
          lecture_slides_id: string
          max_attempts: number
          processed_at: string | null
          prompt: string
          slide_index: number
          slide_title: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          generation_model?: string | null
          id?: string
          image_url?: string | null
          lecture_slides_id: string
          max_attempts?: number
          processed_at?: string | null
          prompt: string
          slide_index: number
          slide_title?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          generation_model?: string | null
          id?: string
          image_url?: string | null
          lecture_slides_id?: string
          max_attempts?: number
          processed_at?: string | null
          prompt?: string
          slide_index?: number
          slide_title?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_generation_queue_lecture_slides_id_fkey"
            columns: ["lecture_slides_id"]
            isOneToOne: false
            referencedRelation: "lecture_slides"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_courses: {
        Row: {
          academic_level: string | null
          access_code: string | null
          code: string | null
          created_at: string | null
          curation_mode: string | null
          default_passing_threshold: number | null
          description: string | null
          detected_domain: string | null
          domain_config: Json | null
          expected_artifacts: string[] | null
          id: string
          instructor_id: string
          is_published: boolean | null
          location_city: string | null
          location_state: string | null
          location_zip: string | null
          search_location: string | null
          syllabus_text: string | null
          title: string
          updated_at: string | null
          verification_threshold: number | null
        }
        Insert: {
          academic_level?: string | null
          access_code?: string | null
          code?: string | null
          created_at?: string | null
          curation_mode?: string | null
          default_passing_threshold?: number | null
          description?: string | null
          detected_domain?: string | null
          domain_config?: Json | null
          expected_artifacts?: string[] | null
          id?: string
          instructor_id: string
          is_published?: boolean | null
          location_city?: string | null
          location_state?: string | null
          location_zip?: string | null
          search_location?: string | null
          syllabus_text?: string | null
          title: string
          updated_at?: string | null
          verification_threshold?: number | null
        }
        Update: {
          academic_level?: string | null
          access_code?: string | null
          code?: string | null
          created_at?: string | null
          curation_mode?: string | null
          default_passing_threshold?: number | null
          description?: string | null
          detected_domain?: string | null
          domain_config?: Json | null
          expected_artifacts?: string[] | null
          id?: string
          instructor_id?: string
          is_published?: boolean | null
          location_city?: string | null
          location_state?: string | null
          location_zip?: string | null
          search_location?: string | null
          syllabus_text?: string | null
          title?: string
          updated_at?: string | null
          verification_threshold?: number | null
        }
        Relationships: []
      }
      instructor_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          depth_level: number
          expires_at: string | null
          id: string
          invitee_email: string
          inviter_id: string
          max_invites_granted: number
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          depth_level?: number
          expires_at?: string | null
          id?: string
          invitee_email: string
          inviter_id: string
          max_invites_granted?: number
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          depth_level?: number
          expires_at?: string | null
          id?: string
          invitee_email?: string
          inviter_id?: string
          max_invites_granted?: number
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "instructor_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles_minimal"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "instructor_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "instructor_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "instructor_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles_minimal"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "instructor_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["user_id"]
          },
        ]
      }
      instructor_invite_codes: {
        Row: {
          auto_approve: boolean | null
          code: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          trust_score_bonus: number | null
        }
        Insert: {
          auto_approve?: boolean | null
          code: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          trust_score_bonus?: number | null
        }
        Update: {
          auto_approve?: boolean | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          trust_score_bonus?: number | null
        }
        Relationships: []
      }
      instructor_role_requests: {
        Row: {
          created_at: string | null
          department: string | null
          email: string
          id: string
          institution_name: string | null
          linkedin_url: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          email: string
          id?: string
          institution_name?: string | null
          linkedin_url?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          department?: string | null
          email?: string
          id?: string
          institution_name?: string | null
          linkedin_url?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      instructor_verifications: {
        Row: {
          created_at: string | null
          department: string | null
          document_urls: string[] | null
          edu_domain_verified: boolean | null
          email_domain: string | null
          id: string
          institution_name: string | null
          linkedin_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: string | null
          submitted_at: string | null
          title: string | null
          trust_score: number | null
          updated_at: string | null
          user_id: string
          verification_method: string
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          document_urls?: string[] | null
          edu_domain_verified?: boolean | null
          email_domain?: string | null
          id?: string
          institution_name?: string | null
          linkedin_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string | null
          submitted_at?: string | null
          title?: string | null
          trust_score?: number | null
          updated_at?: string | null
          user_id: string
          verification_method: string
        }
        Update: {
          created_at?: string | null
          department?: string | null
          document_urls?: string[] | null
          edu_domain_verified?: boolean | null
          email_domain?: string | null
          id?: string
          institution_name?: string | null
          linkedin_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string | null
          submitted_at?: string | null
          title?: string | null
          trust_score?: number | null
          updated_at?: string | null
          user_id?: string
          verification_method?: string
        }
        Relationships: []
      }
      job_requirements: {
        Row: {
          category: string | null
          created_at: string
          dream_job_id: string | null
          id: string
          importance: string | null
          skill_name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          dream_job_id?: string | null
          id?: string
          importance?: string | null
          skill_name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          dream_job_id?: string | null
          id?: string
          importance?: string | null
          skill_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_requirements_dream_job_id_fkey"
            columns: ["dream_job_id"]
            isOneToOne: false
            referencedRelation: "dream_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_requirements_cache: {
        Row: {
          common_misconceptions: Json | null
          created_at: string | null
          day_one_capabilities: Json | null
          differentiators: Json | null
          id: string
          job_query_normalized: string
          keywords: string[] | null
          last_queried_at: string | null
          query_count: number | null
          realistic_bar: string | null
          requirements_text: string
        }
        Insert: {
          common_misconceptions?: Json | null
          created_at?: string | null
          day_one_capabilities?: Json | null
          differentiators?: Json | null
          id?: string
          job_query_normalized: string
          keywords?: string[] | null
          last_queried_at?: string | null
          query_count?: number | null
          realistic_bar?: string | null
          requirements_text: string
        }
        Update: {
          common_misconceptions?: Json | null
          created_at?: string | null
          day_one_capabilities?: Json | null
          differentiators?: Json | null
          id?: string
          job_query_normalized?: string
          keywords?: string[] | null
          last_queried_at?: string | null
          query_count?: number | null
          realistic_bar?: string | null
          requirements_text?: string
        }
        Relationships: []
      }
      learned_synonyms: {
        Row: {
          canonical_term: string
          confidence: number | null
          created_at: string | null
          domain: string
          hit_count: number | null
          id: string
          instructor_course_id: string | null
          synonyms: string[]
          updated_at: string | null
        }
        Insert: {
          canonical_term: string
          confidence?: number | null
          created_at?: string | null
          domain?: string
          hit_count?: number | null
          id?: string
          instructor_course_id?: string | null
          synonyms?: string[]
          updated_at?: string | null
        }
        Update: {
          canonical_term?: string
          confidence?: number | null
          created_at?: string | null
          domain?: string
          hit_count?: number | null
          id?: string
          instructor_course_id?: string | null
          synonyms?: string[]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learned_synonyms_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_objectives: {
        Row: {
          action_verb: string | null
          bloom_level: string | null
          core_concept: string | null
          course_id: string | null
          created_at: string | null
          decomposition_status: string | null
          domain: string | null
          expected_duration_minutes: number | null
          id: string
          instructor_course_id: string | null
          module_id: string | null
          passing_threshold: number | null
          search_keywords: string[] | null
          sequence_order: number | null
          specificity: string | null
          text: string
          updated_at: string | null
          user_id: string
          verification_state: string | null
        }
        Insert: {
          action_verb?: string | null
          bloom_level?: string | null
          core_concept?: string | null
          course_id?: string | null
          created_at?: string | null
          decomposition_status?: string | null
          domain?: string | null
          expected_duration_minutes?: number | null
          id?: string
          instructor_course_id?: string | null
          module_id?: string | null
          passing_threshold?: number | null
          search_keywords?: string[] | null
          sequence_order?: number | null
          specificity?: string | null
          text: string
          updated_at?: string | null
          user_id: string
          verification_state?: string | null
        }
        Update: {
          action_verb?: string | null
          bloom_level?: string | null
          core_concept?: string | null
          course_id?: string | null
          created_at?: string | null
          decomposition_status?: string | null
          domain?: string | null
          expected_duration_minutes?: number | null
          id?: string
          instructor_course_id?: string | null
          module_id?: string | null
          passing_threshold?: number | null
          search_keywords?: string[] | null
          sequence_order?: number | null
          specificity?: string | null
          text?: string
          updated_at?: string | null
          user_id?: string
          verification_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_objectives_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_objectives_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_objectives_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      lecture_slides: {
        Row: {
          audio_audit_log: Json | null
          audio_generated_at: string | null
          audio_status: string | null
          batch_job_id: string | null
          citation_count: number | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          estimated_duration_minutes: number | null
          generation_context: Json | null
          generation_cost_usd: number | null
          generation_model: string | null
          generation_phases: Json | null
          generation_provider: string | null
          has_audio: boolean | null
          id: string
          instructor_course_id: string
          is_research_grounded: boolean | null
          learning_objective_id: string
          quality_score: number | null
          research_context: Json | null
          slide_style: string | null
          slides: Json
          slides_updated_at: string | null
          status: string | null
          teaching_unit_id: string
          title: string
          total_slides: number
          updated_at: string | null
        }
        Insert: {
          audio_audit_log?: Json | null
          audio_generated_at?: string | null
          audio_status?: string | null
          batch_job_id?: string | null
          citation_count?: number | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          estimated_duration_minutes?: number | null
          generation_context?: Json | null
          generation_cost_usd?: number | null
          generation_model?: string | null
          generation_phases?: Json | null
          generation_provider?: string | null
          has_audio?: boolean | null
          id?: string
          instructor_course_id: string
          is_research_grounded?: boolean | null
          learning_objective_id: string
          quality_score?: number | null
          research_context?: Json | null
          slide_style?: string | null
          slides?: Json
          slides_updated_at?: string | null
          status?: string | null
          teaching_unit_id: string
          title: string
          total_slides?: number
          updated_at?: string | null
        }
        Update: {
          audio_audit_log?: Json | null
          audio_generated_at?: string | null
          audio_status?: string | null
          batch_job_id?: string | null
          citation_count?: number | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          estimated_duration_minutes?: number | null
          generation_context?: Json | null
          generation_cost_usd?: number | null
          generation_model?: string | null
          generation_phases?: Json | null
          generation_provider?: string | null
          has_audio?: boolean | null
          id?: string
          instructor_course_id?: string
          is_research_grounded?: boolean | null
          learning_objective_id?: string
          quality_score?: number | null
          research_context?: Json | null
          slide_style?: string | null
          slides?: Json
          slides_updated_at?: string | null
          status?: string | null
          teaching_unit_id?: string
          title?: string
          total_slides?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lecture_slides_batch_job_id_fkey"
            columns: ["batch_job_id"]
            isOneToOne: false
            referencedRelation: "batch_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_slides_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_slides_learning_objective_id_fkey"
            columns: ["learning_objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lecture_slides_teaching_unit_id_fkey"
            columns: ["teaching_unit_id"]
            isOneToOne: true
            referencedRelation: "teaching_units"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_check_results: {
        Row: {
          attempt_number: number | null
          consumption_record_id: string
          created_at: string | null
          id: string
          is_correct: boolean
          micro_check_id: string
          time_taken_seconds: number | null
          user_answer: string | null
        }
        Insert: {
          attempt_number?: number | null
          consumption_record_id: string
          created_at?: string | null
          id?: string
          is_correct: boolean
          micro_check_id: string
          time_taken_seconds?: number | null
          user_answer?: string | null
        }
        Update: {
          attempt_number?: number | null
          consumption_record_id?: string
          created_at?: string | null
          id?: string
          is_correct?: boolean
          micro_check_id?: string
          time_taken_seconds?: number | null
          user_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "micro_check_results_consumption_record_id_fkey"
            columns: ["consumption_record_id"]
            isOneToOne: false
            referencedRelation: "consumption_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "micro_check_results_micro_check_id_fkey"
            columns: ["micro_check_id"]
            isOneToOne: false
            referencedRelation: "micro_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "micro_check_results_micro_check_id_fkey"
            columns: ["micro_check_id"]
            isOneToOne: false
            referencedRelation: "micro_checks_student"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_checks: {
        Row: {
          content_id: string
          correct_answer: string
          created_at: string | null
          created_by: string | null
          id: string
          options: Json | null
          question_text: string
          question_type: string
          rewind_target_seconds: number | null
          time_limit_seconds: number | null
          trigger_time_seconds: number
        }
        Insert: {
          content_id: string
          correct_answer: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          options?: Json | null
          question_text: string
          question_type: string
          rewind_target_seconds?: number | null
          time_limit_seconds?: number | null
          trigger_time_seconds: number
        }
        Update: {
          content_id?: string
          correct_answer?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          options?: Json | null
          question_text?: string
          question_type?: string
          rewind_target_seconds?: number | null
          time_limit_seconds?: number | null
          trigger_time_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "micro_checks_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          instructor_course_id: string
          sequence_order: number
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          instructor_course_id: string
          sequence_order?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          instructor_course_id?: string
          sequence_order?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modules_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      onet_occupations: {
        Row: {
          bright_outlook: boolean | null
          created_at: string
          description: string | null
          education_level: string | null
          employment_count: number | null
          experience_level: string | null
          green_occupation: boolean | null
          id: string
          job_outlook: string | null
          job_outlook_percent: number | null
          median_wage: number | null
          required_abilities: Json | null
          required_knowledge: Json | null
          required_skills: Json | null
          riasec_code: string | null
          riasec_scores: Json | null
          soc_code: string
          title: string
          updated_at: string
          work_values: Json | null
        }
        Insert: {
          bright_outlook?: boolean | null
          created_at?: string
          description?: string | null
          education_level?: string | null
          employment_count?: number | null
          experience_level?: string | null
          green_occupation?: boolean | null
          id?: string
          job_outlook?: string | null
          job_outlook_percent?: number | null
          median_wage?: number | null
          required_abilities?: Json | null
          required_knowledge?: Json | null
          required_skills?: Json | null
          riasec_code?: string | null
          riasec_scores?: Json | null
          soc_code: string
          title: string
          updated_at?: string
          work_values?: Json | null
        }
        Update: {
          bright_outlook?: boolean | null
          created_at?: string
          description?: string | null
          education_level?: string | null
          employment_count?: number | null
          experience_level?: string | null
          green_occupation?: boolean | null
          id?: string
          job_outlook?: string | null
          job_outlook_percent?: number | null
          median_wage?: number | null
          required_abilities?: Json | null
          required_knowledge?: Json | null
          required_skills?: Json | null
          riasec_code?: string | null
          riasec_scores?: Json | null
          soc_code?: string
          title?: string
          updated_at?: string
          work_values?: Json | null
        }
        Relationships: []
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          organization_id: string
          role: string | null
          status: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: string | null
          status?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: string | null
          status?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          department: string | null
          id: string
          is_active: boolean | null
          joined_at: string | null
          organization_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          department?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          organization_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          department?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          organization_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          custom_branding: Json | null
          id: string
          is_active: boolean | null
          license_end_date: string | null
          license_start_date: string | null
          license_tier: string | null
          name: string
          seat_limit: number | null
          seats_used: number | null
          slug: string | null
          sso_config: Json | null
          sso_domain: string | null
          sso_enabled: boolean | null
          stripe_customer_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_branding?: Json | null
          id?: string
          is_active?: boolean | null
          license_end_date?: string | null
          license_start_date?: string | null
          license_tier?: string | null
          name: string
          seat_limit?: number | null
          seats_used?: number | null
          slug?: string | null
          sso_config?: Json | null
          sso_domain?: string | null
          sso_enabled?: boolean | null
          stripe_customer_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_branding?: Json | null
          id?: string
          is_active?: boolean | null
          license_end_date?: string | null
          license_start_date?: string | null
          license_tier?: string | null
          name?: string
          seat_limit?: number | null
          seats_used?: number | null
          slug?: string | null
          sso_config?: Json | null
          sso_domain?: string | null
          sso_enabled?: boolean | null
          stripe_customer_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      partnership_proposals: {
        Row: {
          capstone_project_id: string
          channel: string
          company_profile_id: string | null
          created_at: string
          id: string
          instructor_course_id: string
          instructor_id: string
          message_body: string
          recipient_email: string | null
          recipient_name: string | null
          recipient_title: string | null
          response_notes: string | null
          response_received_at: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_used: string | null
          updated_at: string | null
        }
        Insert: {
          capstone_project_id: string
          channel: string
          company_profile_id?: string | null
          created_at?: string
          id?: string
          instructor_course_id: string
          instructor_id: string
          message_body: string
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_title?: string | null
          response_notes?: string | null
          response_received_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_used?: string | null
          updated_at?: string | null
        }
        Update: {
          capstone_project_id?: string
          channel?: string
          company_profile_id?: string | null
          created_at?: string
          id?: string
          instructor_course_id?: string
          instructor_id?: string
          message_body?: string
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_title?: string | null
          response_notes?: string | null
          response_received_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_used?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partnership_proposals_capstone_project_id_fkey"
            columns: ["capstone_project_id"]
            isOneToOne: false
            referencedRelation: "capstone_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partnership_proposals_company_profile_id_fkey"
            columns: ["company_profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partnership_proposals_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      proctored_sessions: {
        Row: {
          assessment_session_id: string
          browser_focus_losses: number | null
          copy_paste_attempts: number | null
          created_at: string | null
          ended_at: string | null
          fullscreen_exits: number | null
          id: string
          proctoring_passed: boolean | null
          started_at: string | null
          tab_switches: number | null
          user_id: string
          violation_threshold: number | null
          webcam_enabled: boolean | null
          webcam_snapshots_count: number | null
        }
        Insert: {
          assessment_session_id: string
          browser_focus_losses?: number | null
          copy_paste_attempts?: number | null
          created_at?: string | null
          ended_at?: string | null
          fullscreen_exits?: number | null
          id?: string
          proctoring_passed?: boolean | null
          started_at?: string | null
          tab_switches?: number | null
          user_id: string
          violation_threshold?: number | null
          webcam_enabled?: boolean | null
          webcam_snapshots_count?: number | null
        }
        Update: {
          assessment_session_id?: string
          browser_focus_losses?: number | null
          copy_paste_attempts?: number | null
          created_at?: string | null
          ended_at?: string | null
          fullscreen_exits?: number | null
          id?: string
          proctoring_passed?: boolean | null
          started_at?: string | null
          tab_switches?: number | null
          user_id?: string
          violation_threshold?: number | null
          webcam_enabled?: boolean | null
          webcam_snapshots_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proctored_sessions_assessment_session_id_fkey"
            columns: ["assessment_session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_calls_reset_at: string | null
          ai_calls_this_month: number | null
          avatar_url: string | null
          created_at: string
          email: string | null
          email_preferences: Json | null
          full_name: string | null
          graduation_year: number | null
          id: string
          identity_verification_id: string | null
          instructor_trust_score: number | null
          instructor_verification_id: string | null
          invited_by: string | null
          is_identity_verified: boolean | null
          is_instructor_verified: boolean | null
          last_active_at: string | null
          major: string | null
          onboarding_completed: boolean | null
          onboarding_step: number | null
          organization_id: string | null
          preferences: Json | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          student_level: string | null
          subscription_ends_at: string | null
          subscription_started_at: string | null
          subscription_status: string | null
          subscription_tier: string | null
          university: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_calls_reset_at?: string | null
          ai_calls_this_month?: number | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          email_preferences?: Json | null
          full_name?: string | null
          graduation_year?: number | null
          id?: string
          identity_verification_id?: string | null
          instructor_trust_score?: number | null
          instructor_verification_id?: string | null
          invited_by?: string | null
          is_identity_verified?: boolean | null
          is_instructor_verified?: boolean | null
          last_active_at?: string | null
          major?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          organization_id?: string | null
          preferences?: Json | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          student_level?: string | null
          subscription_ends_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          university?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_calls_reset_at?: string | null
          ai_calls_this_month?: number | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          email_preferences?: Json | null
          full_name?: string | null
          graduation_year?: number | null
          id?: string
          identity_verification_id?: string | null
          instructor_trust_score?: number | null
          instructor_verification_id?: string | null
          invited_by?: string | null
          is_identity_verified?: boolean | null
          is_instructor_verified?: boolean | null
          last_active_at?: string | null
          major?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          organization_id?: string | null
          preferences?: Json | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          student_level?: string | null
          subscription_ends_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          university?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_identity_verification_id_fkey"
            columns: ["identity_verification_id"]
            isOneToOne: false
            referencedRelation: "identity_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_instructor_verification_id_fkey"
            columns: ["instructor_verification_id"]
            isOneToOne: false
            referencedRelation: "instructor_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles_minimal"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      project_feedback: {
        Row: {
          capstone_project_id: string
          created_at: string
          feedback_text: string | null
          id: string
          instructor_id: string
          rating: number | null
          tags: string[] | null
        }
        Insert: {
          capstone_project_id: string
          created_at?: string
          feedback_text?: string | null
          id?: string
          instructor_id: string
          rating?: number | null
          tags?: string[] | null
        }
        Update: {
          capstone_project_id?: string
          created_at?: string
          feedback_text?: string | null
          id?: string
          instructor_id?: string
          rating?: number | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "project_feedback_capstone_project_id_fkey"
            columns: ["capstone_project_id"]
            isOneToOne: false
            referencedRelation: "capstone_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_forms: {
        Row: {
          capstone_project_id: string
          created_at: string
          form1_project_details: Json | null
          form2_contact_info: Json | null
          form3_requirements: Json | null
          form4_timeline: Json | null
          form5_logistics: Json | null
          form6_academic: Json | null
          id: string
          milestones: Json | null
          updated_at: string
        }
        Insert: {
          capstone_project_id: string
          created_at?: string
          form1_project_details?: Json | null
          form2_contact_info?: Json | null
          form3_requirements?: Json | null
          form4_timeline?: Json | null
          form5_logistics?: Json | null
          form6_academic?: Json | null
          id?: string
          milestones?: Json | null
          updated_at?: string
        }
        Update: {
          capstone_project_id?: string
          created_at?: string
          form1_project_details?: Json | null
          form2_contact_info?: Json | null
          form3_requirements?: Json | null
          form4_timeline?: Json | null
          form5_logistics?: Json | null
          form6_academic?: Json | null
          id?: string
          milestones?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_forms_capstone_project_id_fkey"
            columns: ["capstone_project_id"]
            isOneToOne: true
            referencedRelation: "capstone_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_metadata: {
        Row: {
          ai_model_version: string | null
          algorithm_transparency: Json | null
          created_at: string
          discovery_quality: Json | null
          enhanced_market_intel: Json | null
          estimated_roi: Json | null
          id: string
          lo_alignment_detail: Json | null
          lo_mapping_deliverables: Json | null
          lo_mapping_tasks: Json | null
          market_alignment_score: number | null
          market_signals_used: Json | null
          partnership_quality_score: number | null
          pricing_breakdown: Json | null
          project_id: string
          salary_projections: Json | null
          skill_gap_analysis: Json | null
          stakeholder_insights: Json | null
          synergistic_value_index: number | null
          updated_at: string
          value_analysis: Json | null
          verification_checks: Json | null
        }
        Insert: {
          ai_model_version?: string | null
          algorithm_transparency?: Json | null
          created_at?: string
          discovery_quality?: Json | null
          enhanced_market_intel?: Json | null
          estimated_roi?: Json | null
          id?: string
          lo_alignment_detail?: Json | null
          lo_mapping_deliverables?: Json | null
          lo_mapping_tasks?: Json | null
          market_alignment_score?: number | null
          market_signals_used?: Json | null
          partnership_quality_score?: number | null
          pricing_breakdown?: Json | null
          project_id: string
          salary_projections?: Json | null
          skill_gap_analysis?: Json | null
          stakeholder_insights?: Json | null
          synergistic_value_index?: number | null
          updated_at?: string
          value_analysis?: Json | null
          verification_checks?: Json | null
        }
        Update: {
          ai_model_version?: string | null
          algorithm_transparency?: Json | null
          created_at?: string
          discovery_quality?: Json | null
          enhanced_market_intel?: Json | null
          estimated_roi?: Json | null
          id?: string
          lo_alignment_detail?: Json | null
          lo_mapping_deliverables?: Json | null
          lo_mapping_tasks?: Json | null
          market_alignment_score?: number | null
          market_signals_used?: Json | null
          partnership_quality_score?: number | null
          pricing_breakdown?: Json | null
          project_id?: string
          salary_projections?: Json | null
          skill_gap_analysis?: Json | null
          stakeholder_insights?: Json | null
          synergistic_value_index?: number | null
          updated_at?: string
          value_analysis?: Json | null
          verification_checks?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "project_metadata_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "capstone_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_challenges: {
        Row: {
          challenged_completed: boolean
          challenged_id: string
          challenged_score: number
          challenger_completed: boolean
          challenger_id: string
          challenger_score: number
          completed_at: string | null
          course_id: string
          created_at: string
          expires_at: string
          id: string
          learning_objective_id: string
          question_ids: string[]
          status: Database["public"]["Enums"]["challenge_status"]
          winner_id: string | null
        }
        Insert: {
          challenged_completed?: boolean
          challenged_id: string
          challenged_score?: number
          challenger_completed?: boolean
          challenger_id: string
          challenger_score?: number
          completed_at?: string | null
          course_id: string
          created_at?: string
          expires_at?: string
          id?: string
          learning_objective_id: string
          question_ids: string[]
          status?: Database["public"]["Enums"]["challenge_status"]
          winner_id?: string | null
        }
        Update: {
          challenged_completed?: boolean
          challenged_id?: string
          challenged_score?: number
          challenger_completed?: boolean
          challenger_id?: string
          challenger_score?: number
          completed_at?: string | null
          course_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          learning_objective_id?: string
          question_ids?: string[]
          status?: Database["public"]["Enums"]["challenge_status"]
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_challenges_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_challenges_learning_objective_id_fkey"
            columns: ["learning_objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_course_links: {
        Row: {
          completed_at: string | null
          created_at: string | null
          external_course_url: string | null
          id: string
          instructor_course_id: string | null
          learning_objective_id: string | null
          link_status: string | null
          link_type: string
          progress_percentage: number | null
          recommendation_id: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          external_course_url?: string | null
          id?: string
          instructor_course_id?: string | null
          learning_objective_id?: string | null
          link_status?: string | null
          link_type: string
          progress_percentage?: number | null
          recommendation_id: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          external_course_url?: string | null
          id?: string
          instructor_course_id?: string | null
          learning_objective_id?: string | null
          link_status?: string | null
          link_type?: string
          progress_percentage?: number | null
          recommendation_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_course_links_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_course_links_learning_objective_id_fkey"
            columns: ["learning_objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_course_links_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: true
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_course_links_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: true
            referencedRelation: "recommendations_with_links"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          cost_usd: number | null
          created_at: string
          deleted_at: string | null
          description: string | null
          dream_job_id: string | null
          duration: string | null
          effort_hours: number | null
          evidence_created: string | null
          gap_addressed: string | null
          gap_analysis_id: string | null
          how_to_demonstrate: string | null
          id: string
          price_known: boolean | null
          priority: string | null
          provider: string | null
          status: string | null
          steps: Json | null
          title: string
          type: string | null
          updated_at: string
          url: string | null
          user_id: string
          why_this_matters: string | null
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          dream_job_id?: string | null
          duration?: string | null
          effort_hours?: number | null
          evidence_created?: string | null
          gap_addressed?: string | null
          gap_analysis_id?: string | null
          how_to_demonstrate?: string | null
          id?: string
          price_known?: boolean | null
          priority?: string | null
          provider?: string | null
          status?: string | null
          steps?: Json | null
          title: string
          type?: string | null
          updated_at?: string
          url?: string | null
          user_id: string
          why_this_matters?: string | null
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          dream_job_id?: string | null
          duration?: string | null
          effort_hours?: number | null
          evidence_created?: string | null
          gap_addressed?: string | null
          gap_analysis_id?: string | null
          how_to_demonstrate?: string | null
          id?: string
          price_known?: boolean | null
          priority?: string | null
          provider?: string | null
          status?: string | null
          steps?: Json | null
          title?: string
          type?: string | null
          updated_at?: string
          url?: string | null
          user_id?: string
          why_this_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_dream_job_id_fkey"
            columns: ["dream_job_id"]
            isOneToOne: false
            referencedRelation: "dream_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_gap_analysis_id_fkey"
            columns: ["gap_analysis_id"]
            isOneToOne: false
            referencedRelation: "gap_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      research_cache: {
        Row: {
          created_at: string | null
          domain: string | null
          expires_at: string
          hit_count: number | null
          id: string
          input_tokens: number | null
          output_tokens: number | null
          research_content: Json
          search_terms: string
          topic_hash: string
        }
        Insert: {
          created_at?: string | null
          domain?: string | null
          expires_at: string
          hit_count?: number | null
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          research_content: Json
          search_terms: string
          topic_hash: string
        }
        Update: {
          created_at?: string | null
          domain?: string | null
          expires_at?: string
          hit_count?: number | null
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          research_content?: Json
          search_terms?: string
          topic_hash?: string
        }
        Relationships: []
      }
      role_audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          performed_by: string
          reason: string | null
          role: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          performed_by: string
          reason?: string | null
          role: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          performed_by?: string
          reason?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      skill_profiles: {
        Row: {
          assessment_version: string | null
          completed_at: string | null
          created_at: string
          holland_code: string | null
          holland_scores: Json | null
          id: string
          technical_skills: Json | null
          updated_at: string
          user_id: string
          work_values: Json | null
        }
        Insert: {
          assessment_version?: string | null
          completed_at?: string | null
          created_at?: string
          holland_code?: string | null
          holland_scores?: Json | null
          id?: string
          technical_skills?: Json | null
          updated_at?: string
          user_id: string
          work_values?: Json | null
        }
        Update: {
          assessment_version?: string | null
          completed_at?: string | null
          created_at?: string
          holland_code?: string | null
          holland_scores?: Json | null
          id?: string
          technical_skills?: Json | null
          updated_at?: string
          user_id?: string
          work_values?: Json | null
        }
        Relationships: []
      }
      skills_assessment_responses: {
        Row: {
          created_at: string
          id: string
          question_id: string
          response_time_ms: number | null
          response_value: number
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          response_time_ms?: number | null
          response_value: number
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          response_time_ms?: number | null
          response_value?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_assessment_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_item_bank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skills_assessment_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "skills_assessment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      skills_assessment_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          current_section: string | null
          expires_at: string
          id: string
          questions_answered: number | null
          session_type: string
          started_at: string
          status: string
          total_questions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_section?: string | null
          expires_at?: string
          id?: string
          questions_answered?: number | null
          session_type?: string
          started_at?: string
          status?: string
          total_questions: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_section?: string | null
          expires_at?: string
          id?: string
          questions_answered?: number | null
          session_type?: string
          started_at?: string
          status?: string
          total_questions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      slide_completions: {
        Row: {
          completed_at: string | null
          created_at: string
          highest_slide_viewed: number
          id: string
          learning_objective_id: string | null
          lecture_slides_id: string
          total_slides: number
          updated_at: string
          user_id: string
          watch_percentage: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          highest_slide_viewed?: number
          id?: string
          learning_objective_id?: string | null
          lecture_slides_id: string
          total_slides?: number
          updated_at?: string
          user_id: string
          watch_percentage?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          highest_slide_viewed?: number
          id?: string
          learning_objective_id?: string | null
          lecture_slides_id?: string
          total_slides?: number
          updated_at?: string
          user_id?: string
          watch_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "slide_completions_learning_objective_id_fkey"
            columns: ["learning_objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slide_completions_lecture_slides_id_fkey"
            columns: ["lecture_slides_id"]
            isOneToOne: false
            referencedRelation: "lecture_slides"
            referencedColumns: ["id"]
          },
        ]
      }
      student_ratings: {
        Row: {
          capstone_project_id: string | null
          created_at: string
          employer_account_id: string | null
          feedback: string | null
          id: string
          rating: number
          skills_demonstrated: string[] | null
          student_id: string
        }
        Insert: {
          capstone_project_id?: string | null
          created_at?: string
          employer_account_id?: string | null
          feedback?: string | null
          id?: string
          rating: number
          skills_demonstrated?: string[] | null
          student_id: string
        }
        Update: {
          capstone_project_id?: string | null
          created_at?: string
          employer_account_id?: string | null
          feedback?: string | null
          id?: string
          rating?: number
          skills_demonstrated?: string[] | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_ratings_capstone_project_id_fkey"
            columns: ["capstone_project_id"]
            isOneToOne: false
            referencedRelation: "capstone_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_ratings_employer_account_id_fkey"
            columns: ["employer_account_id"]
            isOneToOne: false
            referencedRelation: "employer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suggestion_votes: {
        Row: {
          created_at: string | null
          id: string
          suggestion_id: string
          user_id: string
          vote: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          suggestion_id: string
          user_id: string
          vote: number
        }
        Update: {
          created_at?: string | null
          id?: string
          suggestion_id?: string
          user_id?: string
          vote?: number
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "content_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_units: {
        Row: {
          avoid_terms: string[] | null
          common_misconceptions: string[] | null
          created_at: string | null
          description: string | null
          enables: string[] | null
          how_to_teach: string | null
          id: string
          learning_objective_id: string
          prerequisites: string[] | null
          required_concepts: string[] | null
          search_queries: string[]
          sequence_order: number
          status: string | null
          target_duration_minutes: number | null
          target_video_type: string | null
          title: string
          updated_at: string | null
          videos_found_count: number | null
          what_to_teach: string
          why_this_matters: string | null
        }
        Insert: {
          avoid_terms?: string[] | null
          common_misconceptions?: string[] | null
          created_at?: string | null
          description?: string | null
          enables?: string[] | null
          how_to_teach?: string | null
          id?: string
          learning_objective_id: string
          prerequisites?: string[] | null
          required_concepts?: string[] | null
          search_queries?: string[]
          sequence_order: number
          status?: string | null
          target_duration_minutes?: number | null
          target_video_type?: string | null
          title: string
          updated_at?: string | null
          videos_found_count?: number | null
          what_to_teach: string
          why_this_matters?: string | null
        }
        Update: {
          avoid_terms?: string[] | null
          common_misconceptions?: string[] | null
          created_at?: string | null
          description?: string | null
          enables?: string[] | null
          how_to_teach?: string | null
          id?: string
          learning_objective_id?: string
          prerequisites?: string[] | null
          required_concepts?: string[] | null
          search_queries?: string[]
          sequence_order?: number
          status?: string | null
          target_duration_minutes?: number | null
          target_video_type?: string | null
          title?: string
          updated_at?: string | null
          videos_found_count?: number | null
          what_to_teach?: string
          why_this_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teaching_units_learning_objective_id_fkey"
            columns: ["learning_objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_limits: {
        Row: {
          can_access_advanced_analytics: boolean | null
          can_access_premium_content: boolean | null
          can_export_pdf: boolean | null
          can_see_all_recommendations: boolean | null
          created_at: string | null
          max_ai_calls_per_month: number
          max_courses: number
          max_dream_jobs: number
          priority_support: boolean | null
          tier: string
        }
        Insert: {
          can_access_advanced_analytics?: boolean | null
          can_access_premium_content?: boolean | null
          can_export_pdf?: boolean | null
          can_see_all_recommendations?: boolean | null
          created_at?: string | null
          max_ai_calls_per_month: number
          max_courses: number
          max_dream_jobs: number
          priority_support?: boolean | null
          tier: string
        }
        Update: {
          can_access_advanced_analytics?: boolean | null
          can_access_premium_content?: boolean | null
          can_export_pdf?: boolean | null
          can_see_all_recommendations?: boolean | null
          created_at?: string | null
          max_ai_calls_per_month?: number
          max_courses?: number
          max_dream_jobs?: number
          priority_support?: boolean | null
          tier?: string
        }
        Relationships: []
      }
      university_domains: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          domain: string
          formatted_location: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string | null
          state: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          domain: string
          formatted_location?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          state?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          domain?: string
          formatted_location?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          state?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          earned_at: string | null
          id: string
          notified: boolean | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string | null
          id?: string
          notified?: boolean | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string | null
          id?: string
          notified?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_xp: {
        Row: {
          level: number | null
          total_xp: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          level?: number | null
          total_xp?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          level?: number | null
          total_xp?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      verified_skills: {
        Row: {
          created_at: string | null
          evidence_url: string | null
          id: string
          metadata: Json | null
          proficiency_level: string | null
          skill_name: string
          source_id: string | null
          source_name: string | null
          source_type: string
          updated_at: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          evidence_url?: string | null
          id?: string
          metadata?: Json | null
          proficiency_level?: string | null
          skill_name: string
          source_id?: string | null
          source_name?: string | null
          source_type: string
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          evidence_url?: string | null
          id?: string
          metadata?: Json | null
          proficiency_level?: string | null
          skill_name?: string
          source_id?: string | null
          source_name?: string | null
          source_type?: string
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      certificates_public_verify: {
        Row: {
          certificate_number: string | null
          certificate_type: string | null
          completion_date: string | null
          course_title: string | null
          id: string | null
          identity_verified: boolean | null
          institution_name: string | null
          instructor_name: string | null
          instructor_verified: boolean | null
          issued_at: string | null
          mastery_score: number | null
          share_token: string | null
          skill_breakdown: Json | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          certificate_number?: string | null
          certificate_type?: string | null
          completion_date?: string | null
          course_title?: string | null
          id?: string | null
          identity_verified?: boolean | null
          institution_name?: string | null
          instructor_name?: string | null
          instructor_verified?: boolean | null
          issued_at?: string | null
          mastery_score?: number | null
          share_token?: string | null
          skill_breakdown?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          certificate_number?: string | null
          certificate_type?: string | null
          completion_date?: string | null
          course_title?: string | null
          id?: string | null
          identity_verified?: boolean | null
          institution_name?: string | null
          instructor_name?: string | null
          instructor_verified?: boolean | null
          issued_at?: string | null
          mastery_score?: number | null
          share_token?: string | null
          skill_breakdown?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      micro_checks_student: {
        Row: {
          content_id: string | null
          created_at: string | null
          id: string | null
          options: Json | null
          question_text: string | null
          question_type: string | null
          rewind_target_seconds: number | null
          time_limit_seconds: number | null
          trigger_time_seconds: number | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          id?: string | null
          options?: never
          question_text?: string | null
          question_type?: string | null
          rewind_target_seconds?: number | null
          time_limit_seconds?: number | null
          trigger_time_seconds?: number | null
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          id?: string | null
          options?: never
          question_text?: string | null
          question_type?: string | null
          rewind_target_seconds?: number | null
          time_limit_seconds?: number | null
          trigger_time_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "micro_checks_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations_safe: {
        Row: {
          created_at: string | null
          custom_branding: Json | null
          id: string | null
          is_active: boolean | null
          license_end_date: string | null
          license_start_date: string | null
          license_tier: string | null
          name: string | null
          seat_limit: number | null
          seats_used: number | null
          slug: string | null
          sso_config: Json | null
          sso_domain: string | null
          sso_enabled: boolean | null
          stripe_customer_id: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_branding?: Json | null
          id?: string | null
          is_active?: boolean | null
          license_end_date?: never
          license_start_date?: never
          license_tier?: never
          name?: string | null
          seat_limit?: never
          seats_used?: never
          slug?: string | null
          sso_config?: never
          sso_domain?: string | null
          sso_enabled?: boolean | null
          stripe_customer_id?: never
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_branding?: Json | null
          id?: string | null
          is_active?: boolean | null
          license_end_date?: never
          license_start_date?: never
          license_tier?: never
          name?: string | null
          seat_limit?: never
          seats_used?: never
          slug?: string | null
          sso_config?: never
          sso_domain?: string | null
          sso_enabled?: boolean | null
          stripe_customer_id?: never
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles_minimal: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles_safe: {
        Row: {
          ai_calls_reset_at: string | null
          ai_calls_this_month: number | null
          avatar_url: string | null
          created_at: string | null
          email: string | null
          email_preferences: Json | null
          full_name: string | null
          graduation_year: number | null
          id: string | null
          identity_verification_id: string | null
          instructor_trust_score: number | null
          instructor_verification_id: string | null
          is_identity_verified: boolean | null
          is_instructor_verified: boolean | null
          last_active_at: string | null
          major: string | null
          onboarding_completed: boolean | null
          onboarding_step: number | null
          organization_id: string | null
          preferences: Json | null
          student_level: string | null
          subscription_ends_at: string | null
          subscription_started_at: string | null
          subscription_status: string | null
          subscription_tier: string | null
          university: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_calls_reset_at?: string | null
          ai_calls_this_month?: number | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          email_preferences?: Json | null
          full_name?: string | null
          graduation_year?: number | null
          id?: string | null
          identity_verification_id?: string | null
          instructor_trust_score?: number | null
          instructor_verification_id?: string | null
          is_identity_verified?: boolean | null
          is_instructor_verified?: boolean | null
          last_active_at?: string | null
          major?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          organization_id?: string | null
          preferences?: Json | null
          student_level?: string | null
          subscription_ends_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          university?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_calls_reset_at?: string | null
          ai_calls_this_month?: number | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          email_preferences?: Json | null
          full_name?: string | null
          graduation_year?: number | null
          id?: string | null
          identity_verification_id?: string | null
          instructor_trust_score?: number | null
          instructor_verification_id?: string | null
          is_identity_verified?: boolean | null
          is_instructor_verified?: boolean | null
          last_active_at?: string | null
          major?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
          organization_id?: string | null
          preferences?: Json | null
          student_level?: string | null
          subscription_ends_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          university?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_identity_verification_id_fkey"
            columns: ["identity_verification_id"]
            isOneToOne: false
            referencedRelation: "identity_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_instructor_verification_id_fkey"
            columns: ["instructor_verification_id"]
            isOneToOne: false
            referencedRelation: "instructor_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations_with_links: {
        Row: {
          cost_usd: number | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          dream_job_id: string | null
          duration: string | null
          effort_hours: number | null
          enrollment_completed_at: string | null
          enrollment_progress: number | null
          evidence_created: string | null
          gap_addressed: string | null
          gap_analysis_id: string | null
          how_to_demonstrate: string | null
          id: string | null
          instructor_course_id: string | null
          learning_objective_id: string | null
          link_progress: number | null
          link_status: string | null
          link_type: string | null
          linked_course_code: string | null
          linked_course_title: string | null
          linked_external_url: string | null
          price_known: boolean | null
          priority: string | null
          provider: string | null
          status: string | null
          steps: Json | null
          title: string | null
          type: string | null
          updated_at: string | null
          url: string | null
          user_id: string | null
          why_this_matters: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_course_links_instructor_course_id_fkey"
            columns: ["instructor_course_id"]
            isOneToOne: false
            referencedRelation: "instructor_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_course_links_learning_objective_id_fkey"
            columns: ["learning_objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_dream_job_id_fkey"
            columns: ["dream_job_id"]
            isOneToOne: false
            referencedRelation: "dream_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_gap_analysis_id_fkey"
            columns: ["gap_analysis_id"]
            isOneToOne: false
            referencedRelation: "gap_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_organization_invitation: {
        Args: { invitation_token: string }
        Returns: Json
      }
      add_verified_skill_from_course: {
        Args: {
          p_course_id: string
          p_course_name: string
          p_evidence_url?: string
          p_proficiency_level: string
          p_skill_name: string
          p_user_id: string
        }
        Returns: {
          created_at: string | null
          evidence_url: string | null
          id: string
          metadata: Json | null
          proficiency_level: string | null
          skill_name: string
          source_id: string | null
          source_name: string | null
          source_type: string
          updated_at: string | null
          user_id: string
          verified_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "verified_skills"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      award_xp: {
        Args: { p_amount: number; p_user_id: string }
        Returns: {
          leveled_up: boolean
          new_level: number
          new_xp: number
        }[]
      }
      calculate_level: { Args: { xp: number }; Returns: number }
      check_achievements: {
        Args: { p_user_id: string }
        Returns: {
          newly_granted: string[]
        }[]
      }
      check_generation_trigger: {
        Args: { p_instructor_course_id: string }
        Returns: number
      }
      check_tier_limit: {
        Args: { p_limit_type: string; p_user_id: string }
        Returns: boolean
      }
      cleanup_expired_cache: { Args: never; Returns: number }
      cleanup_expired_research_cache: { Args: never; Returns: number }
      evaluate_challenge_answer: {
        Args: {
          p_challenge_id: string
          p_question_id: string
          p_selected_option_index?: number
          p_time_taken_seconds?: number
          p_user_answer: string
        }
        Returns: Json
      }
      find_similar_cached_search: {
        Args: {
          p_keywords: string[]
          p_min_overlap?: number
          p_source?: string
        }
        Returns: {
          id: string
          overlap_score: number
          results: Json
          search_concept: string
        }[]
      }
      find_similar_cached_search_dynamic: {
        Args: {
          p_course_id?: string
          p_keywords: string[]
          p_min_overlap?: number
          p_source: string
        }
        Returns: {
          id: string
          results: Json
          search_concept: string
          similarity_score: number
        }[]
      }
      find_similar_capabilities: {
        Args: {
          result_limit?: number
          target_keywords: string[]
          user_uuid: string
        }
        Returns: {
          capability_id: string
          capability_name: string
          course_title: string
          similarity_score: number
        }[]
      }
      generate_certificate_number: { Args: never; Returns: string }
      generate_employer_api_key: {
        Args: { p_employer_account_id: string; p_name?: string }
        Returns: {
          api_key: string
          key_id: string
        }[]
      }
      generate_share_token: { Args: never; Returns: string }
      get_dynamic_synonyms: {
        Args: { p_course_id?: string; p_term: string }
        Returns: string[]
      }
      get_invite_quota: {
        Args: { p_user_id: string }
        Returns: {
          remaining: number
          total_allowed: number
          total_used: number
        }[]
      }
      get_remaining_quota: {
        Args: { p_api_name: string; p_daily_limit?: number }
        Returns: number
      }
      get_subscription_details: {
        Args: { p_user_id: string }
        Returns: {
          ai_calls_limit: number
          ai_calls_used: number
          can_access_advanced_analytics: boolean
          can_export_pdf: boolean
          can_see_all_recommendations: boolean
          courses_limit: number
          courses_used: number
          dream_jobs_limit: number
          dream_jobs_used: number
          status: string
          subscription_ends_at: string
          tier: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_skill_profile: {
        Args: { p_user_id: string }
        Returns: {
          acquired_at: string
          evidence_url: string
          proficiency_level: string
          skill_name: string
          source_name: string
          source_type: string
          verified: boolean
        }[]
      }
      grant_achievement: {
        Args: { p_achievement_key: string; p_user_id: string }
        Returns: {
          achievement_name: string
          granted: boolean
          xp_awarded: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_ai_usage: {
        Args: { p_user_id: string }
        Returns: {
          allowed: boolean
          current_usage: number
          max_usage: number
          tier: string
        }[]
      }
      increment_api_usage: {
        Args: { p_api_name: string; p_units?: number }
        Returns: undefined
      }
      increment_cache_hit: { Args: { p_cache_id: string }; Returns: undefined }
      initialize_generation_triggers: {
        Args: { p_instructor_course_id: string }
        Returns: number
      }
      is_course_instructor: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      is_edu_domain: { Args: { email_address: string }; Returns: boolean }
      is_enrolled_student: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      keyword_similarity: {
        Args: { arr1: string[]; arr2: string[] }
        Returns: number
      }
      link_recommendation_to_course: {
        Args: {
          p_external_url?: string
          p_instructor_course_id?: string
          p_learning_objective_id?: string
          p_recommendation_id: string
        }
        Returns: {
          completed_at: string | null
          created_at: string | null
          external_course_url: string | null
          id: string
          instructor_course_id: string | null
          learning_objective_id: string | null
          link_status: string | null
          link_type: string
          progress_percentage: number | null
          recommendation_id: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "recommendation_course_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_primary_dream_job: {
        Args: { p_job_id: string; p_user_id: string }
        Returns: Json
      }
      track_api_usage: {
        Args: { p_api_name: string; p_units?: number }
        Returns: number
      }
      use_invite_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: Json
      }
      validate_micro_check_answer: {
        Args: {
          p_micro_check_id: string
          p_selected_option_index?: number
          p_user_answer: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "student" | "instructor" | "admin"
      challenge_status:
        | "pending"
        | "active"
        | "completed"
        | "expired"
        | "declined"
      subscription_tier: "free" | "pro" | "university"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "instructor", "admin"],
      challenge_status: [
        "pending",
        "active",
        "completed",
        "expired",
        "declined",
      ],
      subscription_tier: ["free", "pro", "university"],
    },
  },
} as const
