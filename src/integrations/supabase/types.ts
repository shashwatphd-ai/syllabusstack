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
      courses: {
        Row: {
          ai_cost_usd: number | null
          ai_model_used: string | null
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
          last_queried_at?: string | null
          query_count?: number | null
          realistic_bar?: string | null
          requirements_text?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          graduation_year: number | null
          id: string
          major: string | null
          onboarding_completed: boolean | null
          student_level: string | null
          university: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          graduation_year?: number | null
          id?: string
          major?: string | null
          onboarding_completed?: boolean | null
          student_level?: string | null
          university?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          graduation_year?: number | null
          id?: string
          major?: string | null
          onboarding_completed?: boolean | null
          student_level?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
