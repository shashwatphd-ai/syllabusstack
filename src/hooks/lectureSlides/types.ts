/**
 * Lecture Slides Type Definitions
 *
 * Contains all type definitions, interfaces, and type guards for lecture slides.
 */

// Legacy slide format (v1)
export interface Slide {
  order: number;
  type: 'title' | 'objectives' | 'prerequisites' | 'concept' | 'example' |
        'worked_problem' | 'misconception' | 'summary' | 'discussion' | 'assessment';
  title: string;
  content: string[];
  speaker_notes: string;
  visual_suggestion: string;
  audio_url?: string;
  audio_urls?: Record<string, string>;
  audio_duration_seconds?: number;
}

// Enhanced slide format (v2) - research-grounded with citations
export interface EnhancedSlide {
  order: number;
  type: 'title' | 'definition' | 'explanation' | 'example' | 'process' |
        'diagram' | 'misconception' | 'case_study' | 'summary' | 'assessment';
  title: string;
  content: {
    main_text: string;
    bullets?: string[];
    definition?: {
      term: string;
      meaning: string;
      source: string;
    };
    steps?: {
      step: number;
      title: string;
      explanation: string;
    }[];
    example?: {
      scenario: string;
      explanation: string;
      source?: string;
    };
  };
  visual: {
    type: 'diagram' | 'image' | 'chart' | 'none';
    url?: string;
    alt_text: string;
    source?: string;
    fallback_description: string;
    educational_purpose?: string;
  };
  speaker_notes: string;
  audio_url?: string;
  audio_urls?: Record<string, string>;
  audio_duration_seconds?: number;
  speaker_notes_duration_seconds?: number;
  citations?: {
    claim: string;
    source: string;
    url?: string;
  }[];
  quality_score?: number;
}

// AI-generated layout hint for adaptive rendering
export interface LayoutHint {
  type: 'flow' | 'comparison' | 'equation' | 'list' | 'quote' | 'callout' | 'plain';
  segments?: string[];        // For flows: ["Step 1", "Step 2", "Step 3"]
  left_right?: [string, string]; // For comparisons: ["Left side", "Right side"]
  formula?: string;           // For equations: "E = mc²"
  emphasis_words?: string[];  // Words to bold/highlight
}

// Key point with optional layout hint for adaptive rendering
export interface KeyPointWithHint {
  text: string;
  layout_hint?: LayoutHint;
}

// Professor AI slide format (v3) - comprehensive pedagogical structure
export interface ProfessorSlide {
  order: number;
  type: 'title' | 'hook' | 'recap' | 'definition' | 'explanation' |
        'example' | 'demonstration' | 'misconception' | 'practice' |
        'synthesis' | 'preview' | 'process' | 'summary';
  title: string;
  content: {
    main_text: string;
    // Support both string[] (legacy) and KeyPointWithHint[] (new with layout hints)
    key_points?: (string | KeyPointWithHint)[];
    definition?: {
      term: string;
      formal_definition: string;
      simple_explanation: string;
    };
    example?: {
      scenario: string;
      walkthrough: string;
      connection_to_concept: string;
    };
    misconception?: {
      wrong_belief: string;
      why_wrong: string;
      correct_understanding: string;
    };
    steps?: {
      step: number;
      title: string;
      explanation: string;
    }[];
  };
  // Audio segment map for synchronized highlighting
  audio_segment_map?: {
    target_block: string;
    start_percent: number;
    end_percent: number;
    narration_excerpt?: string;
  }[];
  audio_url?: string;
  audio_urls?: Record<string, string>;
  audio_duration_seconds?: number;
  visual_directive?: {
    type: 'diagram' | 'screenshot' | 'comparison' | 'flowchart' | 'illustration' | 'none';
    description: string;
    elements?: string[];
    style?: string;
    educational_purpose?: string;
  };
  visual: {
    type: 'diagram' | 'screenshot' | 'comparison' | 'flowchart' | 'illustration' | 'none';
    url?: string | null;
    alt_text: string;
    fallback_description: string;
    elements?: string[];
    style?: string;
    educational_purpose?: string;
    source?: string;
  };
  speaker_notes: string;
  speaker_notes_duration_seconds?: number;
  pedagogy?: {
    purpose: string;
    bloom_action: string;
    transition_to_next: string;
  };
  quality_score?: number;
}

// Type guard for Professor AI slides (v3)
export function isProfessorSlide(slide: Slide | EnhancedSlide | ProfessorSlide): slide is ProfessorSlide {
  return 'content' in slide &&
         typeof slide.content === 'object' &&
         slide.content !== null &&
         'main_text' in slide.content &&
         'pedagogy' in slide;
}

export interface LectureSlide {
  id: string;
  teaching_unit_id: string;
  learning_objective_id: string;
  instructor_course_id: string;
  title: string;
  slides: Slide[] | EnhancedSlide[];
  total_slides: number;
  estimated_duration_minutes: number | null;
  slide_style: 'standard' | 'minimal' | 'detailed' | 'interactive';
  generation_context: Record<string, unknown> | null;
  generation_model: string | null;
  status: 'pending' | 'preparing' | 'batch_pending' | 'generating' | 'ready' | 'published' | 'failed';
  error_message: string | null;
  has_audio: boolean | null;
  audio_status: 'pending' | 'generating' | 'ready' | 'failed' | null;
  audio_generated_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // V2 fields
  research_context?: {
    definitions?: unknown[];
    examples?: unknown[];
    citations?: unknown[];
  };
  generation_phases?: {
    current_phase?: string;
    progress_percent?: number;
    completed?: string;
  };
  quality_score?: number;
  citation_count?: number;
  is_research_grounded?: boolean;
}

// Type guard to check if slides are enhanced (v2) format
export function isEnhancedSlide(slide: Slide | EnhancedSlide): slide is EnhancedSlide {
  return 'content' in slide && typeof slide.content === 'object' && 'main_text' in (slide.content || {});
}

// Queue status type
export interface QueueStatus {
  success: boolean;
  total: number;
  pending: number;
  generating: number;
  ready: number;
  published: number;
  failed: number;
}

// Generation progress type
export interface GenerationProgress {
  phase: string;
  percent: number;
  message: string;
}
