// ============================================================================
// SHARED SLIDE SYSTEM TYPES - Single source of truth for all slide functions
// ============================================================================
//
// Used by: generate-lecture-slides-v3, generate-batch-slides, generate-slide-media
// Canonical source: extracted from generate-lecture-slides-v3/index.ts
//

// Layout hint for adaptive content rendering
export interface LayoutHint {
  type: 'flow' | 'comparison' | 'equation' | 'list' | 'quote' | 'callout' | 'plain';
  segments?: string[];           // For flows: ["Step 1", "Step 2", "Step 3"]
  left_right?: [string, string]; // For comparisons: ["Vision", "Mission"]
  formula?: string;              // For equations: "ROI = (Gain - Cost) / Cost"
  emphasis_words?: string[];     // Words to highlight
}

export interface ProfessorSlide {
  order: number;
  type: 'title' | 'hook' | 'recap' | 'definition' | 'explanation' |
        'example' | 'demonstration' | 'misconception' | 'practice' |
        'synthesis' | 'preview' | 'process' | 'summary';
  title: string;
  content: {
    main_text: string;
    main_text_layout?: LayoutHint;
    key_points?: string[];
    key_points_layout?: LayoutHint[];
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
  visual_directive: {
    type: 'diagram' | 'screenshot' | 'comparison' | 'flowchart' | 'illustration' | 'none';
    description: string;
    elements: string[];
    style: string;
    educational_purpose?: string;
  };
  speaker_notes: string;
  estimated_seconds: number;
  pedagogy: {
    purpose: string;
    bloom_action: string;
    transition_to_next: string;
  };
}

// AI-generated domain configuration for research grounding
export interface DomainConfig {
  domain: string;
  trusted_sites: string[];
  citation_style: string;
  avoid_sources: string[];
  visual_templates: string[];
  academic_level: string;
  terminology_preferences: string[];
}

// Research context from Google Search grounding
export interface ResearchContext {
  topic: string;
  grounded_content: {
    claim: string;
    source_url: string;
    source_title: string;
    confidence: number;
  }[];
  recommended_reading: {
    title: string;
    url: string;
    type: 'Academic' | 'Industry' | 'Case Study' | 'Documentation';
  }[];
  visual_descriptions: {
    framework_name: string;
    description: string;
    elements: string[];
  }[];
  raw_grounding_metadata?: any;
}

export interface TeachingUnitContext {
  id: string;
  title: string;
  what_to_teach: string;
  why_this_matters: string;
  how_to_teach: string;
  target_duration_minutes: number;
  target_video_type: string;
  prerequisites: string[];
  enables: string[];
  common_misconceptions: string[];
  required_concepts: string[];
  avoid_terms: string[];
  search_queries: string[];
  domain: string;
  syllabus_text?: string;
  learning_objective: {
    id: string;
    text: string;
    bloom_level: string;
    core_concept: string;
    action_verb: string;
  };
  module: {
    title: string;
    description: string;
    sequence_order: number;
  };
  course: {
    id: string;
    title: string;
    detected_domain: string;
    code: string;
  };
  sibling_units: {
    id: string;
    title: string;
    what_to_teach: string;
    sequence_order: number;
  }[];
  sequence_position: number;
  total_siblings: number;
  domain_config?: DomainConfig | null;
}

// Slide format as stored in the lecture_slides.slides JSONB column
export interface StoredSlide {
  order: number;
  type: string;
  title: string;
  content: {
    main_text?: string;
    main_text_layout?: LayoutHint;
    key_points?: string[];
    key_points_layout?: LayoutHint[];
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
    [key: string]: unknown;
  };
  visual_directive?: {
    type: string;
    description: string;
    elements?: string[];
    style?: string;
    educational_purpose?: string;
  };
  visual?: {
    type?: string;
    url: string | null;
    alt_text: string;
    fallback_description: string;
    elements?: string[];
    style?: string;
    educational_purpose?: string;
    source?: string;
  };
  speaker_notes?: string;
  speaker_notes_duration_seconds?: number;
  estimated_seconds?: number;
  pedagogy?: {
    purpose?: string;
    bloom_action?: string;
    transition_to_next?: string;
  };
  quality_score?: number;
}
