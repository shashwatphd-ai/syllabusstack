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
          capability_embedding: string | null
          combined_capability_text: string | null
          course_count: number | null
          created_at: string
          id: string
          last_updated: string
          user_id: string
        }
        Insert: {
          capabilities_by_theme?: Json | null
          capability_embedding?: string | null
          combined_capability_text?: string | null
          course_count?: number | null
          created_at?: string
          id?: string
          last_updated?: string
          user_id: string
        }
        Update: {
          capabilities_by_theme?: Json | null
          capability_embedding?: string | null
          combined_capability_text?: string | null
          course_count?: number | null
          created_at?: string
          id?: string
          last_updated?: string
          user_id?: string
        }
        Relationships: []
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
      course_enrollments: {
        Row: {
          completed_at: string | null
          enrolled_at: string | null
          id: string
          instructor_course_id: string
          overall_progress: number | null
          student_id: string
        }
        Insert: {
          completed_at?: string | null
          enrolled_at?: string | null
          id?: string
          instructor_course_id: string
          overall_progress?: number | null
          student_id: string
        }
        Update: {
          completed_at?: string | null
          enrolled_at?: string | null
          id?: string
          instructor_course_id?: string
          overall_progress?: number | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_instructor_course_id_fkey"
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
      instructor_courses: {
        Row: {
          access_code: string | null
          code: string | null
          created_at: string | null
          curation_mode: string | null
          description: string | null
          id: string
          instructor_id: string
          is_published: boolean | null
          title: string
          updated_at: string | null
          verification_threshold: number | null
        }
        Insert: {
          access_code?: string | null
          code?: string | null
          created_at?: string | null
          curation_mode?: string | null
          description?: string | null
          id?: string
          instructor_id: string
          is_published?: boolean | null
          title: string
          updated_at?: string | null
          verification_threshold?: number | null
        }
        Update: {
          access_code?: string | null
          code?: string | null
          created_at?: string | null
          curation_mode?: string | null
          description?: string | null
          id?: string
          instructor_id?: string
          is_published?: boolean | null
          title?: string
          updated_at?: string | null
          verification_threshold?: number | null
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
          requirements_embedding: string | null
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
          requirements_embedding?: string | null
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
          requirements_embedding?: string | null
          requirements_text?: string
        }
        Relationships: []
      }
      learning_objectives: {
        Row: {
          action_verb: string | null
          bloom_level: string | null
          core_concept: string | null
          course_id: string | null
          created_at: string | null
          domain: string | null
          expected_duration_minutes: number | null
          id: string
          instructor_course_id: string | null
          module_id: string | null
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
          domain?: string | null
          expected_duration_minutes?: number | null
          id?: string
          instructor_course_id?: string | null
          module_id?: string | null
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
          domain?: string | null
          expected_duration_minutes?: number | null
          id?: string
          instructor_course_id?: string | null
          module_id?: string | null
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
          last_active_at: string | null
          major: string | null
          onboarding_completed: boolean | null
          onboarding_step: number | null
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
          last_active_at?: string | null
          major?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
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
          last_active_at?: string | null
          major?: string | null
          onboarding_completed?: boolean | null
          onboarding_step?: number | null
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
        Relationships: []
      }
      recommendations: {
        Row: {
          cost_usd: number | null
          created_at: string
          description: string | null
          dream_job_id: string | null
          duration: string | null
          effort_hours: number | null
          evidence_created: string | null
          gap_addressed: string | null
          gap_analysis_id: string | null
          how_to_demonstrate: string | null
          id: string
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
          description?: string | null
          dream_job_id?: string | null
          duration?: string | null
          effort_hours?: number | null
          evidence_created?: string | null
          gap_addressed?: string | null
          gap_analysis_id?: string | null
          how_to_demonstrate?: string | null
          id?: string
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
          description?: string | null
          dream_job_id?: string | null
          duration?: string | null
          effort_hours?: number | null
          evidence_created?: string | null
          gap_addressed?: string | null
          gap_analysis_id?: string | null
          how_to_demonstrate?: string | null
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_xp: {
        Args: { p_amount: number; p_user_id: string }
        Returns: {
          leveled_up: boolean
          new_level: number
          new_total_xp: number
        }[]
      }
      calculate_level: { Args: { xp: number }; Returns: number }
      check_achievements: {
        Args: { p_user_id: string }
        Returns: {
          newly_earned: string[]
        }[]
      }
      check_tier_limit: {
        Args: { p_limit_type: string; p_user_id: string }
        Returns: boolean
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
      grant_achievement: {
        Args: { p_achievement_key: string; p_user_id: string }
        Returns: {
          achievement_granted: boolean
          achievement_name: string
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
      keyword_similarity: {
        Args: { arr1: string[]; arr2: string[] }
        Returns: number
      }
    }
    Enums: {
      app_role: "student" | "instructor" | "admin"
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
      subscription_tier: ["free", "pro", "university"],
    },
  },
} as const
