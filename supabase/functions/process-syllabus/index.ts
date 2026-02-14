import { createClient } from "@supabase/supabase-js";
import { unzipSync, strFromU8 } from "npm:fflate@^0.8.2";
import {
  extractDomainTerms,
  detectDomain,
  storeExtractedTerms,
  getLearnedSynonyms,
} from "../_shared/dynamic-terms.ts";
import { generateText, MODELS, parseJsonResponse } from "../_shared/unified-ai-client.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandling,
  logInfo,
  logError,
} from "../_shared/error-handler.ts";
import { checkRateLimit, getUserLimits, createRateLimitResponse } from "../_shared/rate-limiter.ts";

// ========== DOCX Local Extraction (same as parse-syllabus-document) ==========
function base64ToU8(base64: string): Uint8Array {
  const bin = atob(base64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function decodeXmlEntities(text: string): string {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function extractTextFromDocxXml(documentXml: string): string {
  const paragraphs = documentXml.match(/<w:p[\s\S]*?<\/w:p>/g) ?? [];
  const lines: string[] = [];

  for (const p of paragraphs) {
    const runs = [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => decodeXmlEntities(m[1] ?? ""));
    const line = runs.join("").replace(/\s+/g, " ").trim();
    if (line) lines.push(line);
  }

  if (lines.length === 0) {
    const runs = [...documentXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => decodeXmlEntities(m[1] ?? ""));
    return runs.join(" ").replace(/\s+/g, " ").trim();
  }

  return lines.join("\n");
}

function extractDocxTextFromBase64(base64Content: string): string {
  const bytes = base64ToU8(base64Content);
  const files = unzipSync(bytes);
  const documentXmlBytes = files["word/document.xml"];
  if (!documentXmlBytes) {
    throw new Error("Invalid DOCX: missing word/document.xml");
  }
  const documentXml = strFromU8(documentXmlBytes);
  return extractTextFromDocxXml(documentXml);
}

// ========== DIRECT GEMINI API HELPER ==========
// Bypasses OpenRouter to avoid 100KB body size limit (HTTP 413)
// Gemini 3 Flash has 1M token input context, handles any syllabus size
async function callGeminiDirect(
  prompt: string,
  apiKey: string,
  options: {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    jsonOutput?: boolean;
    logPrefix?: string;
  } = {}
): Promise<string> {
  const model = options.model || 'gemini-3-flash-preview';
  const logPrefix = options.logPrefix || '[GeminiDirect]';
  console.log(`${logPrefix} Calling ${model}, prompt: ${prompt.length} chars`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // deno-lint-ignore no-explicit-any
  const generationConfig: Record<string, any> = {
    temperature: options.temperature ?? 0.3,
    maxOutputTokens: options.maxOutputTokens ?? 65536,
  };
  if (options.jsonOutput) {
    generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err.substring(0, 500)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  console.log(`${logPrefix} Response: ${text.length} chars`);
  return text;
}

// Duration matrix: Bloom level x Specificity (in minutes)
const DURATION_MATRIX: Record<string, Record<string, number>> = {
  remember: { introductory: 5, intermediate: 8, advanced: 12 },
  understand: { introductory: 8, intermediate: 12, advanced: 18 },
  apply: { introductory: 12, intermediate: 18, advanced: 25 },
  analyze: { introductory: 15, intermediate: 22, advanced: 30 },
  evaluate: { introductory: 18, intermediate: 25, advanced: 35 },
  create: { introductory: 20, intermediate: 30, advanced: 40 },
};

// ============================================================================
// DOMAIN CONFIG INTERFACES - Universal Adaptive Engine
// ============================================================================

// AI-generated domain configuration for research grounding
interface DomainConfig {
  domain: string;                    // "strategic management", "organic chemistry", etc.
  trusted_sites: string[];           // ["hbr.org", "jstor.org", ".edu"]
  citation_style: string;            // "Case studies and academic references"
  avoid_sources: string[];           // ["seo-blogs", "opinion-pieces"]
  visual_templates: string[];        // ["framework diagrams", "comparison tables"]
  academic_level: string;            // "graduate", "undergraduate", "professional"
  terminology_preferences: string[]; // Domain-specific terms to prioritize
  // Enrichment metadata (stored from structure analysis)
  syllabus_metadata?: {
    textbooks?: string[];
    grading_structure?: Record<string, number>;
  };
}

// ============================================================================
// DOMAIN ANALYZER - AI-powered domain classification
// ============================================================================

async function analyzeDomainWithAI(
  syllabusText: string
): Promise<DomainConfig> {
  console.log('[DOMAIN-ANALYZER] Starting AI-powered domain analysis');

  const metaPrompt = `You are an Academic Director analyzing a course syllabus to determine research strategy.

SYLLABUS TEXT:
${syllabusText.substring(0, 8000)}

TASK: Generate research configuration rules for this academic field. This will be used to find authoritative sources when creating lecture content.

OUTPUT (JSON only, no markdown, no code blocks):
{
  "domain": "Specific academic field (e.g., 'Strategic Management', 'Organic Chemistry', 'Renaissance Art History', 'Machine Learning', 'Nursing Practice')",
  "trusted_sites": [
    "3-6 authoritative domains for this specific field",
    "Examples by field:",
    "- Business: hbr.org, mckinsey.com, scholar.google.com",
    "- Medicine: nih.gov, pubmed.ncbi.nlm.nih.gov, mayoclinic.org",
    "- CS: docs.python.org, developer.mozilla.org, github.com",
    "- History: jstor.org, archives.gov, smithsonianmag.com",
    "- Engineering: ieee.org, asme.org, sciencedirect.com"
  ],
  "citation_style": "How citations should appear (e.g., 'APA format with case studies', 'IEEE format with code examples', 'Chicago style with primary sources')",
  "avoid_sources": [
    "Source types that should NOT be used for this field",
    "e.g., 'seo-blogs', 'opinion-pieces', 'news-articles', 'wikipedia'"
  ],
  "visual_templates": [
    "Common visual formats in this field",
    "e.g., 'framework diagrams', 'molecular structures', 'architectural drawings', 'circuit diagrams', 'flowcharts'"
  ],
  "academic_level": "graduate | undergraduate | professional",
  "terminology_preferences": [
    "5-10 domain-specific terms that indicate quality content in this field"
  ]
}

CRITICAL RULES:
1. Analyze the syllabus content to identify the EXACT academic domain
2. Choose trusted_sites that are THE authoritative sources for this specific field
3. Be specific - "Computational Linguistics" not just "Computer Science"
4. Match academic_level to the syllabus complexity`;

  try {
    // Use direct Gemini API for consistency (no OpenRouter dependency)
    const rawContent = await callGeminiDirect(
      metaPrompt,
      Deno.env.get("GOOGLE_CLOUD_API_KEY")!,
      {
        temperature: 0.3,
        maxOutputTokens: 8192,
        jsonOutput: true,
        logPrefix: '[DOMAIN-ANALYZER]',
      }
    );

    if (!rawContent) {
      console.warn('[DOMAIN-ANALYZER] AI returned no content');
      return getFallbackDomainConfig(syllabusText);
    }

    try {
      const config = parseJsonResponse<DomainConfig>(rawContent);
      console.log(`[DOMAIN-ANALYZER] AI identified domain: ${config.domain}`);
      console.log(`[DOMAIN-ANALYZER] Trusted sites: ${config.trusted_sites.slice(0, 3).join(', ')}`);
      return config;
    } catch (parseError) {
      console.warn('[DOMAIN-ANALYZER] Parse failed, using fallback');
      return getFallbackDomainConfig(syllabusText);
    }
  } catch (error) {
    console.error('[DOMAIN-ANALYZER] Error:', error);
    return getFallbackDomainConfig(syllabusText);
  }
}

function getFallbackDomainConfig(text: string): DomainConfig {
  const detectedDomain = detectDomain(text);
  console.log(`[DOMAIN-ANALYZER] Using fallback for domain: ${detectedDomain}`);
  
  // Domain-specific fallback configurations
  const domainConfigs: Record<string, Partial<DomainConfig>> = {
    business: {
      trusted_sites: ['hbr.org', 'mckinsey.com', 'scholar.google.com', '.edu'],
      visual_templates: ['framework diagrams', 'comparison matrices', 'process flowcharts'],
    },
    medicine: {
      trusted_sites: ['nih.gov', 'pubmed.ncbi.nlm.nih.gov', 'mayoclinic.org', 'who.int'],
      visual_templates: ['anatomical diagrams', 'clinical flowcharts', 'mechanism illustrations'],
    },
    science: {
      trusted_sites: ['nature.com', 'sciencedirect.com', 'scholar.google.com', '.edu'],
      visual_templates: ['experimental diagrams', 'molecular structures', 'data visualizations'],
    },
    technical: {
      trusted_sites: ['developer.mozilla.org', 'docs.python.org', 'github.com', 'stackoverflow.com'],
      visual_templates: ['architecture diagrams', 'flowcharts', 'code snippets', 'system diagrams'],
    },
    humanities: {
      trusted_sites: ['jstor.org', 'muse.jhu.edu', 'scholar.google.com', '.edu'],
      visual_templates: ['timeline diagrams', 'concept maps', 'historical images'],
    },
    arts: {
      trusted_sites: ['moma.org', 'metmuseum.org', 'jstor.org', '.edu'],
      visual_templates: ['artwork reproductions', 'technique diagrams', 'comparative images'],
    },
  };

  const domainDefaults = domainConfigs[detectedDomain] || domainConfigs.humanities;

  return {
    domain: detectedDomain,
    trusted_sites: domainDefaults.trusted_sites || ['scholar.google.com', '.edu', 'jstor.org'],
    citation_style: 'Academic references with URLs',
    avoid_sources: ['seo-blogs', 'opinion-pieces', 'unreferenced-wikis'],
    visual_templates: domainDefaults.visual_templates || ['diagrams', 'flowcharts'],
    academic_level: 'undergraduate',
    terminology_preferences: [],
  };
}

// ============================================================================
// ENRICHED INTERFACES - Support richer extraction from detailed syllabi
// ============================================================================

interface Module {
  title: string;
  description: string;
  learning_objectives: LearningObjective[];
  key_topics?: string[];
  assessment_type?: string;
  readings?: string[];
}

interface LearningObjective {
  text: string;
  core_concept: string;
  action_verb: string;
  bloom_level: string;
  domain: string;
  specificity: string;
  search_keywords: string[];
  prerequisites?: string[];
}

interface CourseStructure {
  course_title?: string;
  course_description?: string;
  modules: Module[];
  unassigned_objectives: LearningObjective[];
  textbooks?: string[];
  grading_structure?: Record<string, number>;
}

/**
 * Unified syllabus processor that:
 * 1. Extracts text from PDF using Gemini
 * 2. Analyzes structure to generate modules
 * 3. Extracts learning objectives and assigns to modules
 * 4. Saves everything to the database
 */
Deno.serve(async (req: Request) => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    const GOOGLE_CLOUD_API_KEY = Deno.env.get("GOOGLE_CLOUD_API_KEY");

    if (!GOOGLE_CLOUD_API_KEY) {
      throw new Error("GOOGLE_CLOUD_API_KEY is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Rate limit check
    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const limits = await getUserLimits(serviceClient, user.id);
    const rateLimitResult = await checkRateLimit(serviceClient, user.id, 'process-syllabus', limits);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }

    const { document_base64, document_url, instructor_course_id, file_name } = await req.json();

    if (!document_base64 && !document_url) {
      throw new Error("Either document_base64 or document_url is required");
    }
    if (!instructor_course_id) {
      throw new Error("instructor_course_id is required");
    }

    console.log(`Processing syllabus for course ${instructor_course_id}`);

    // ========== STEP 1: Get document content and determine type ==========
    let base64Content: string;
    let mimeType = "application/pdf";

    if (document_base64) {
      base64Content = document_base64;
      if (file_name) {
        const ext = file_name.toLowerCase().split('.').pop();
        if (ext === 'docx') mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        else if (ext === 'doc') mimeType = "application/msword";
        else if (ext === 'png') mimeType = "image/png";
        else if (ext === 'jpg' || ext === 'jpeg') mimeType = "image/jpeg";
      }
    } else {
      const docResponse = await fetch(document_url);
      if (!docResponse.ok) {
        throw new Error(`Failed to fetch document: ${docResponse.status}`);
      }
      
      const contentType = docResponse.headers.get("content-type");
      if (contentType) mimeType = contentType;
      
      const buffer = await docResponse.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      base64Content = btoa(binary);
    }

    // ========== STEP 2: Extract text from document ==========
    // Determine if this is a DOCX file
    const isDocx = mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    let extractedText: string;

    if (isDocx) {
      // ========== LOCAL DOCX EXTRACTION (Gemini doesn't support DOCX) ==========
      console.log("Extracting text from DOCX locally");
      try {
        extractedText = extractDocxTextFromBase64(base64Content);
        console.log(`Extracted ${extractedText.length} characters from DOCX locally`);
      } catch (docxError) {
        console.error("DOCX extraction error:", docxError);
        throw new Error("Failed to extract text from DOCX file");
      }
    } else {
      // ========== GEMINI EXTRACTION (for PDF, images, etc.) ==========
      // Upgraded to gemini-3-flash-preview with 65536 max output tokens
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GOOGLE_CLOUD_API_KEY}`;
      
      const extractionResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Content
                }
              },
              {
                text: `Extract ALL text content from this syllabus document. 
                
Include:
- Course title and code
- Instructor information
- Course description and objectives
- Weekly schedule and topics
- Assignments and grading criteria
- Required textbooks and materials
- Learning outcomes
- Reading lists and references
- Project descriptions and rubrics

Format the extracted text clearly, preserving the document structure.
Do NOT summarize - extract the complete text content.`
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 65536,
          }
        })
      });

      if (!extractionResponse.ok) {
        const errorText = await extractionResponse.text();
        console.error("Gemini extraction error:", errorText);
        throw new Error(`Failed to extract text from document: ${extractionResponse.status}`);
      }

      const extractionData = await extractionResponse.json();
      extractedText = extractionData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      console.log(`Extracted ${extractedText.length} characters from PDF via Gemini 3 Flash`);
    }

    if (!extractedText || extractedText.length < 50) {
      throw new Error("Could not extract sufficient text from the document");
    }

    // ========== STEP 1.5: AI-Powered Domain Analysis (Universal Adaptive Engine) ==========
    // This generates domain-specific research rules for lecture grounding
    console.log('[PROCESS-SYLLABUS] Starting AI-powered domain analysis');
    
    // Generate comprehensive domain configuration using AI
    const domainConfig = await analyzeDomainWithAI(extractedText);
    console.log(`[PROCESS-SYLLABUS] Generated domain config for: ${domainConfig.domain}`);
    console.log(`[PROCESS-SYLLABUS] Trusted sites: ${domainConfig.trusted_sites.slice(0, 3).join(', ')}`);
    
    // Also extract domain terms for synonym matching (background)
    const extractedTerms = extractDomainTerms(extractedText);
    console.log(`[PROCESS-SYLLABUS] Extracted ${extractedTerms.length} domain terms`);

    // Store extracted terms in the database (fire and forget for speed)
    storeExtractedTerms(instructor_course_id, extractedTerms, domainConfig.domain).catch(e => {
      console.log(`[PROCESS-SYLLABUS] Failed to store extracted terms: ${e}`);
    });

    // Store syllabus text, domain, AND full domain_config in instructor_courses
    await supabaseClient
      .from('instructor_courses')
      .update({
        syllabus_text: extractedText.substring(0, 50000), // Limit to 50KB
        detected_domain: domainConfig.domain,
        domain_config: domainConfig, // Store full AI-generated config
      })
      .eq('id', instructor_course_id);

    // Trigger synonym learning in background (fire and forget)
    getLearnedSynonyms(instructor_course_id, extractedText).catch(e => {
      console.log(`[PROCESS-SYLLABUS] Background synonym learning error: ${e}`);
    });

    // ========== STEP 2: Analyze structure and generate modules + LOs ==========
    const structurePrompt = `You are an expert educational analyst. Analyze this course syllabus and extract:
1. The course structure (modules/units/weeks)
2. Learning objectives for each module
3. Any learning objectives that don't fit into a specific module

SYLLABUS TEXT:
${extractedText}

Return a JSON object with this EXACT structure (no markdown, just raw JSON):
{
  "course_title": "Optional: Extracted course title if found",
  "course_description": "Optional: Brief course description if found",
  "textbooks": ["Author - Title (Year)", "..."],
  "grading_structure": {"Midterm": 30, "Final": 40, "Assignments": 30},
  "modules": [
    {
      "title": "Module 1: Introduction to...",
      "description": "Brief description of this module",
      "key_topics": ["topic1", "topic2", "topic3"],
      "assessment_type": "exam|project|essay|lab|quiz|presentation|none",
      "readings": ["Chapter 1 of Author - Title", "Article: Name"],
      "learning_objectives": [
        {
          "text": "Full learning objective text",
          "core_concept": "Main topic in 2-4 words",
          "action_verb": "Bloom's taxonomy verb (e.g., analyze, apply)",
          "bloom_level": "remember|understand|apply|analyze|evaluate|create",
          "domain": "business|science|humanities|technical|arts|other",
          "specificity": "introductory|intermediate|advanced",
          "search_keywords": ["keyword1", "keyword2", "keyword3"],
          "prerequisites": ["concept A", "concept B"]
        }
      ]
    }
  ],
  "unassigned_objectives": [
    {
      "text": "Learning objective that doesn't fit a specific module",
      "core_concept": "...",
      "action_verb": "...",
      "bloom_level": "...",
      "domain": "...",
      "specificity": "...",
      "search_keywords": ["..."],
      "prerequisites": ["..."]
    }
  ]
}

RULES:
1. Create 3-15 modules based on the syllabus structure (weeks, units, chapters). Short syllabi may have 3-5; detailed syllabi with many weeks/topics should have 8-15.
2. Extract 2-6 learning objectives per module
3. If explicit learning objectives aren't found, infer them from topics and assignments
4. Use action verbs that match Bloom's taxonomy levels
5. Search keywords should help find relevant educational YouTube videos
6. CRITICAL: Each learning objective must appear in EXACTLY ONE module - do NOT duplicate objectives across modules
7. Course-level objectives (that apply to the whole course) should go in "unassigned_objectives"
8. If an objective seems relevant to multiple modules, assign it to the MOST specific module or to unassigned_objectives
9. If the syllabus contains assessment details, reading lists, project descriptions, textbooks, or grading weights, ALWAYS extract them into the corresponding fields. These fields are optional — omit them only if truly absent from the document.
10. For prerequisites, list specific concepts a student should know BEFORE tackling this objective.`;

    // Use direct Gemini API — bypasses OpenRouter 100KB body limit
    // Gemini 3 Flash has 1M token input context, handles any syllabus size
    let structureResultContent: string;
    try {
      structureResultContent = await callGeminiDirect(
        structurePrompt,
        GOOGLE_CLOUD_API_KEY,
        {
          temperature: 0.3,
          maxOutputTokens: 65536,
          jsonOutput: true,
          logPrefix: '[process-syllabus:structure]',
        }
      );
    } catch (directError) {
      // Fallback: OpenRouter with truncated text if Google API fails
      console.error('[process-syllabus] Direct Gemini failed, falling back to OpenRouter:', directError);
      const truncatedPrompt = structurePrompt.substring(0, 90000) +
        '\n\n[Document truncated for size. Extract what you can from available text.]';
      const fallbackResult = await generateText({
        prompt: truncatedPrompt,
        model: MODELS.GEMINI_FLASH,
        logPrefix: '[process-syllabus:structure-fallback]',
      });
      structureResultContent = fallbackResult.content;
    }

    if (!structureResultContent) {
      throw new Error("No content returned from AI");
    }

    // Parse the JSON response
    let courseStructure: CourseStructure;
    try {
      courseStructure = parseJsonResponse<CourseStructure>(structureResultContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", structureResultContent.substring(0, 500));
      throw new Error("Failed to parse course structure from AI response");
    }

    // ========== Enrich domain_config with course-level metadata ==========
    if (courseStructure.textbooks || courseStructure.grading_structure) {
      const enrichedConfig = {
        ...domainConfig,
        syllabus_metadata: {
          textbooks: courseStructure.textbooks,
          grading_structure: courseStructure.grading_structure,
        },
      };
      // Update domain_config with enriched metadata (fire and forget)
      Promise.resolve(
        supabaseClient
          .from('instructor_courses')
          .update({ domain_config: enrichedConfig })
          .eq('id', instructor_course_id)
      )
        .then(() => console.log('[PROCESS-SYLLABUS] Stored enriched syllabus metadata in domain_config'))
        .catch((e: unknown) => console.warn('[PROCESS-SYLLABUS] Failed to store enriched metadata:', e));
    }

    // ========== STEP 3: Save modules and learning objectives to database ==========
    // BATCHED APPROACH: 2 queries instead of N+M queries (100x faster for large syllabi)

    // Step 3a: Batch insert ALL modules at once
    const modulesData = courseStructure.modules.map((module, i) => {
      // Enrich module description with key_topics, readings, and assessment_type
      let enrichedDescription = module.description || '';
      if (module.key_topics?.length) {
        enrichedDescription += `\n\nKey Topics: ${module.key_topics.join(', ')}`;
      }
      if (module.readings?.length) {
        enrichedDescription += `\n\nReadings: ${module.readings.join('; ')}`;
      }
      if (module.assessment_type && module.assessment_type !== 'none') {
        enrichedDescription += `\n\nAssessment: ${module.assessment_type}`;
      }

      return {
        instructor_course_id: instructor_course_id,
        title: module.title,
        description: enrichedDescription.trim() || null,
        sequence_order: i + 1,
      };
    });

    const { data: savedModules, error: modulesError } = await supabaseClient
      .from("modules")
      .insert(modulesData)
      .select();

    if (modulesError) {
      console.error("Error batch saving modules:", modulesError);
      throw new Error("Failed to save modules");
    }

    // Create a map from sequence_order to module ID for LO assignment
    const moduleIdByIndex = new Map<number, string>();
    savedModules?.forEach((m: { id: string }, i: number) => moduleIdByIndex.set(i, m.id));

    // Step 3b: Build ALL learning objectives with correct module_ids
    // DEDUPLICATION: Track seen LO texts to prevent duplicates
    let sequenceOrder = 1;
    const losData: Record<string, unknown>[] = [];
    const seenLoTexts = new Set<string>();
    
    // Helper to normalize LO text for deduplication
    const normalizeLOText = (text: string): string => {
      return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    };

    // Add LOs from modules
    courseStructure.modules.forEach((module, moduleIndex) => {
      const moduleId = moduleIdByIndex.get(moduleIndex);
      for (const lo of module.learning_objectives) {
        // Deduplication check
        const normalizedText = normalizeLOText(lo.text);
        if (seenLoTexts.has(normalizedText)) {
          console.log(`[PROCESS-SYLLABUS] Skipping duplicate LO: "${lo.text.substring(0, 50)}..."`);
          continue;
        }
        seenLoTexts.add(normalizedText);
        
        const bloomLevel = lo.bloom_level || "understand";
        const specificity = lo.specificity || "intermediate";
        const expectedDuration = DURATION_MATRIX[bloomLevel]?.[specificity] || 15;

        // Enrich search_keywords with prerequisite terms for better content matching
        const enrichedKeywords = [...(lo.search_keywords || [])];
        if (lo.prerequisites?.length) {
          for (const prereq of lo.prerequisites) {
            const prereqTerms = prereq.toLowerCase().split(/\s+/).filter(t => t.length > 3);
            for (const term of prereqTerms) {
              if (!enrichedKeywords.includes(term)) {
                enrichedKeywords.push(term);
              }
            }
          }
        }

        losData.push({
          user_id: user.id,
          instructor_course_id: instructor_course_id,
          module_id: moduleId,
          text: lo.text,
          core_concept: lo.core_concept,
          action_verb: lo.action_verb,
          bloom_level: bloomLevel,
          domain: lo.domain || "other",
          specificity: specificity,
          search_keywords: enrichedKeywords,
          expected_duration_minutes: expectedDuration,
          verification_state: "unstarted",
          sequence_order: sequenceOrder++,
        });
      }
    });

    // Add unassigned LOs (no module) - with deduplication
    for (const lo of courseStructure.unassigned_objectives || []) {
      // Deduplication check
      const normalizedText = normalizeLOText(lo.text);
      if (seenLoTexts.has(normalizedText)) {
        console.log(`[PROCESS-SYLLABUS] Skipping duplicate unassigned LO: "${lo.text.substring(0, 50)}..."`);
        continue;
      }
      seenLoTexts.add(normalizedText);
      
      const bloomLevel = lo.bloom_level || "understand";
      const specificity = lo.specificity || "intermediate";
      const expectedDuration = DURATION_MATRIX[bloomLevel]?.[specificity] || 15;

      // Enrich search_keywords with prerequisite terms
      const enrichedKeywords = [...(lo.search_keywords || [])];
      if (lo.prerequisites?.length) {
        for (const prereq of lo.prerequisites) {
          const prereqTerms = prereq.toLowerCase().split(/\s+/).filter(t => t.length > 3);
          for (const term of prereqTerms) {
            if (!enrichedKeywords.includes(term)) {
              enrichedKeywords.push(term);
            }
          }
        }
      }

      losData.push({
        user_id: user.id,
        instructor_course_id: instructor_course_id,
        module_id: null,
        text: lo.text,
        core_concept: lo.core_concept,
        action_verb: lo.action_verb,
        bloom_level: bloomLevel,
        domain: lo.domain || "other",
        specificity: specificity,
        search_keywords: enrichedKeywords,
        expected_duration_minutes: expectedDuration,
        verification_state: "unstarted",
        sequence_order: sequenceOrder++,
      });
    }
    
    console.log(`[PROCESS-SYLLABUS] After deduplication: ${losData.length} unique LOs (skipped ${seenLoTexts.size - losData.length} duplicates)`);

    // Step 3c: Batch insert ALL learning objectives at once
    const { data: savedLOs, error: losError } = await supabaseClient
      .from("learning_objectives")
      .insert(losData)
      .select();

    if (losError) {
      console.error("Error batch saving LOs:", losError);
      // Don't throw - we've already saved modules, LOs are secondary
    }

    console.log(`Created ${savedModules?.length || 0} modules and ${savedLOs?.length || 0} learning objectives`);

    // ========================================================================
    // NEW: Trigger batch curriculum decomposition (async, fire-and-forget)
    // ========================================================================
    const enableBatchCurriculum = Deno.env.get('ENABLE_BATCH_CURRICULUM') !== 'false';

    if (enableBatchCurriculum && savedLOs && savedLOs.length >= 3) {
      console.log(`[PROCESS-SYLLABUS] Triggering batch curriculum decomposition for ${savedLOs.length} LOs`);

      // Fire and forget - don't block syllabus processing
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      fetch(`${supabaseUrl}/functions/v1/submit-batch-curriculum`, {
        method: 'POST',
        headers: {
          'Authorization': req.headers.get('Authorization') || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instructor_course_id: instructor_course_id,
          learning_objective_ids: savedLOs.map((lo: any) => lo.id)
        })
      }).then(res => {
        if (res.ok) {
          console.log('[PROCESS-SYLLABUS] Batch curriculum job submitted successfully');
        } else {
          console.warn('[PROCESS-SYLLABUS] Batch curriculum submission failed, will use sync fallback');
        }
      }).catch(err => {
        console.warn('[PROCESS-SYLLABUS] Batch curriculum submission error:', err);
        // Non-blocking - content search will use sync fallback
      });
    } else {
      console.log(`[PROCESS-SYLLABUS] Skipping batch curriculum: enabled=${enableBatchCurriculum}, LO count=${savedLOs?.length || 0}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        extracted_text_length: extractedText.length,
        course_title: courseStructure.course_title,
        course_description: courseStructure.course_description,
        modules: savedModules || [],
        learning_objectives: savedLOs || [],
        module_count: savedModules?.length || 0,
        lo_count: savedLOs?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in process-syllabus:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
