EduThree
Complete Technical Specification & Implementation Manual
AI-Native Career Navigation Platform

Version 3.0 | December 2025 | CONFIDENTIAL

 
Table of Contents
Part 1: Executive Summary & Core Philosophy
Part 2: Technical Architecture Overview
Part 3: TanStack Integration Strategy
Part 4: AI Orchestration Layer (Multi-Model)
Part 5: Database Schema (Supabase)
Part 6: API Specification (Edge Functions)
Part 7: Complete Prompt Library
Part 8: Frontend Components & UI Specification
Part 9: Workflow Orchestration
Part 10: Cost Optimization Strategy
Part 11: Build Sequence (4-Week Sprint)
Part 12: Deployment & Infrastructure
Part 13: Testing Strategy
Part 14: Success Metrics & Monitoring
Appendices: Environment Variables, File Structure, Seed Data

 
Part 1: Executive Summary & Core Philosophy
1.1 What EduThree Is
EduThree is an AI-native career navigation platform that helps students understand their job-readiness through intelligent analysis of their coursework against real job market requirements. Unlike traditional career tools that use keyword matching and static databases, EduThree generates every analysis dynamically using large language models.
1.2 Core Philosophy
Nothing is hardcoded. No fixed skill taxonomies, no predetermined job lists, no static recommendation libraries. Every insight is generated contextually by AI.
AI does the thinking. Claude/Gemini analyzes, matches, and recommends—not database lookups. The system understands context, nuance, and relationships that keyword matching cannot.
Honesty over encouragement. Students receive realistic assessments. '58% match' is meaningless. 'Competitive for associate roles at non-tech companies but not yet for tech PM because you lack X, Y, Z' is actionable.
Specificity is required. Generic advice fails. 'Complete Mode Analytics SQL tutorial, focus on JOINs (15 hours), addresses your gap in data querying which will eliminate you from PM interviews' succeeds.
1.3 Business Model
Students use EduThree FREE. Revenue from institutions:
Revenue Source Price Point Why They Pay
University Licenses $3-5/student/year Career services needs outcomes data
Employer Sponsorships $500-2,000/month Access to qualified talent pool
Affiliate Commissions 20-40% Coursera/Udemy pay for qualified leads

Year 1 Target: $210K revenue, $185K profit, 88% gross margin.

 
Part 2: Technical Architecture Overview
2.1 Technology Stack
Layer Technology
Frontend Framework React 18 + TypeScript
State Management TanStack Query (React Query v5)
Routing TanStack Router
Forms TanStack Form + Zod validation
Tables TanStack Table
Styling Tailwind CSS + shadcn/ui
Backend Supabase (PostgreSQL + Auth + Storage + Edge Functions)
AI Primary Google Vertex AI (Gemini 1.5 Pro, Gemini 1.5 Flash)
AI Secondary Anthropic Claude (Claude 3.5 Sonnet)
AI Embeddings OpenAI (text-embedding-3-small)
Vector Storage Supabase pgvector extension
File Processing pdf-parse, mammoth (docx)
Deployment Vercel (frontend) + Supabase (backend)
Monitoring Sentry + Supabase Analytics
2.2 Why Multi-Model AI
Different models excel at different tasks. Using a single provider is expensive and suboptimal:
Task Model Rationale
Text extraction Gemini 1.5 Flash $0.075/1M tokens, fast
Capability analysis Gemini 1.5 Pro $1.25/1M, strong reasoning
Gap analysis Claude 3.5 Sonnet $3/1M, best nuanced comparison
Recommendations Claude 3.5 Sonnet Best actionable advice
Embeddings text-embedding-3-small $0.02/1M, excellent quality/cost
Classification Gemini 1.5 Flash Fastest, cheapest routing
2.3 Architecture Diagram
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (React + TanStack) │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Router │ │ Query │ │ Form │ │ Table │ │
│ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
└───────┼─────────────┼────────────┼──────────────┼───────────┘
└─────────────┴────────────┴──────────────┘
│
┌─────────▼─────────┐
│ Supabase Edge │
│ Functions │
└─────────┬─────────┘
│
┌─────────────────────┼─────────────────────┐
│ │ │
┌────▼────┐ ┌────────▼────────┐ ┌────▼────┐
│ Supabase│ │ AI Orchestrator │ │ Supabase│
│PostgreSQL│ │ ┌───────────┐ │ │ Storage │
│+pgvector │ │ │Gemini Flash│ │ │(Syllabi)│
└──────────┘ │ │Gemini Pro │ │ └─────────┘
│ │Claude Sonnet│ │
│ │OpenAI Embed │ │
│ └───────────┘ │
└─────────────────┘

 
Part 3: TanStack Integration Strategy
3.1 TanStack Query Configuration
TanStack Query manages all server state with automatic caching, background refetching, and error handling.
Query Client Setup
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
defaultOptions: {
queries: {
staleTime: 1000 _ 60 _ 5, // 5 minutes
gcTime: 1000 _ 60 _ 30, // 30 minutes
retry: 3,
retryDelay: (attemptIndex) => Math.min(1000 \* 2 \*\* attemptIndex, 30000),
refetchOnWindowFocus: false,
},
mutations: {
retry: 1,
},
},
});
Query Keys Factory
// src/lib/query-keys.ts
export const queryKeys = {
user: {
all: ['user'] as const,
profile: () => [...queryKeys.user.all, 'profile'] as const,
},
courses: {
all: ['courses'] as const,
list: (userId: string) => [...queryKeys.courses.all, 'list', userId] as const,
detail: (courseId: string) => [...queryKeys.courses.all, 'detail', courseId] as const,
},
dreamJobs: {
all: ['dreamJobs'] as const,
list: (userId: string) => [...queryKeys.dreamJobs.all, 'list', userId] as const,
detail: (jobId: string) => [...queryKeys.dreamJobs.all, 'detail', jobId] as const,
},
analysis: {
all: ['analysis'] as const,
gap: (userId: string, jobId: string) => [...queryKeys.analysis.all, 'gap', userId, jobId] as const,
recommendations: (userId: string, jobId: string) =>
[...queryKeys.analysis.all, 'recommendations', userId, jobId] as const,
},
dashboard: {
all: ['dashboard'] as const,
overview: (userId: string) => [...queryKeys.dashboard.all, 'overview', userId] as const,
},
};
Custom Hook Pattern
// src/hooks/useCourses.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';

export function useCourses(userId: string) {
return useQuery({
queryKey: queryKeys.courses.list(userId),
queryFn: async () => {
const { data, error } = await supabase
.from('courses')
.select('\*')
.eq('user_id', userId)
.order('created_at', { ascending: false });
if (error) throw error;
return data;
},
enabled: !!userId,
});
}

export function useAddCourse() {
const queryClient = useQueryClient();

return useMutation({
mutationFn: async (course) => {
const { data, error } = await supabase
.from('courses')
.insert(course)
.select()
.single();
if (error) throw error;
return data;
},
onSuccess: (data) => {
queryClient.invalidateQueries({ queryKey: queryKeys.courses.list(data.user_id) });
queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
},
});
}
3.2 TanStack Router Setup
// src/router.tsx
import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router';
import { z } from 'zod';

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
getParentRoute: () => rootRoute,
path: '/',
component: LandingPage,
});

const dashboardRoute = createRoute({
getParentRoute: () => rootRoute,
path: '/dashboard',
beforeLoad: async ({ context }) => {
const session = await context.supabase.auth.getSession();
if (!session.data.session) throw redirect({ to: '/login' });
},
component: DashboardPage,
});

// Dream job with search params validation
const dreamJobDetailRoute = createRoute({
getParentRoute: () => rootRoute,
path: '/dream-jobs/$jobId',
validateSearch: z.object({
tab: z.enum(['overview', 'gaps', 'recommendations']).optional().default('overview'),
}),
component: DreamJobDetailPage,
});

export const router = createRouter({
routeTree: rootRoute.addChildren([
indexRoute,
dashboardRoute,
dreamJobDetailRoute,
]),
defaultPreload: 'intent',
});
3.3 TanStack Form with Zod
// src/components/forms/AddCourseForm.tsx
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';
import { z } from 'zod';

const courseSchema = z.object({
name: z.string().min(1, 'Required').max(200),
code: z.string().optional(),
syllabus_text: z.string().optional(),
syllabus_file: z.instanceof(File).optional(),
}).refine(
(data) => data.syllabus_text || data.syllabus_file,
{ message: 'Syllabus text or file required' }
);

export function AddCourseForm({ userId, onSuccess }) {
const form = useForm({
defaultValues: { name: '', code: '', syllabus_text: '' },
validatorAdapter: zodValidator(),
validators: { onChange: courseSchema },
onSubmit: async ({ value }) => {
// 1. Extract text if file uploaded
// 2. Call analyze-syllabus Edge Function
// 3. Save course with AI analysis
onSuccess();
},
});

return (
<form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
<form.Field name="name" children={(field) => (
<input
value={field.state.value}
onChange={(e) => field.handleChange(e.target.value)}
placeholder="Course Name"
/>
)} />
{/_ Additional fields _/}
</form>
);
}

 
Part 4: AI Orchestration Layer (Multi-Model)
4.1 Model Selection Strategy
The AI orchestrator routes requests to optimal models based on task complexity, cost, and latency:
AI Orchestrator Implementation
// supabase/functions/\_shared/ai-orchestrator.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const genAI = new GoogleGenerativeAI(Deno.env.get('GOOGLE_AI_API_KEY')!);
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });

const MODELS = {
GEMINI_FLASH: 'gemini-1.5-flash',
GEMINI_PRO: 'gemini-1.5-pro',
CLAUDE_SONNET: 'claude-3-5-sonnet-20241022',
EMBEDDING: 'text-embedding-3-small',
};

const COSTS = {
[MODELS.GEMINI_FLASH]: { input: 0.075, output: 0.30 },
[MODELS.GEMINI_PRO]: { input: 1.25, output: 5.00 },
[MODELS.CLAUDE_SONNET]: { input: 3.00, output: 15.00 },
[MODELS.EMBEDDING]: { input: 0.02, output: 0 },
};

type TaskType = 'syllabus_extraction' | 'capability_analysis' |
'job_requirements' | 'gap_analysis' |
'recommendations' | 'embedding';

function getModelForTask(task: TaskType) {
switch (task) {
case 'syllabus_extraction':
return { primary: MODELS.GEMINI_FLASH, fallback: MODELS.GEMINI_PRO };
case 'capability_analysis':
case 'job_requirements':
return { primary: MODELS.GEMINI_PRO, fallback: MODELS.CLAUDE_SONNET };
case 'gap_analysis':
case 'recommendations':
return { primary: MODELS.CLAUDE_SONNET, fallback: MODELS.GEMINI_PRO };
case 'embedding':
return { primary: MODELS.EMBEDDING, fallback: MODELS.EMBEDDING };
}
}

export async function executeAITask({ task, prompt, systemPrompt, maxTokens = 4096 }) {
const { primary, fallback } = getModelForTask(task);

if (task === 'embedding') {
const response = await openai.embeddings.create({
model: MODELS.EMBEDDING,
input: prompt,
});
return { content: JSON.stringify(response.data[0].embedding), model: MODELS.EMBEDDING };
}

try {
if (primary.startsWith('gemini')) {
const model = genAI.getGenerativeModel({ model: primary, systemInstruction: systemPrompt });
const result = await model.generateContent(prompt);
return { content: result.response.text(), model: primary };
} else {
const message = await anthropic.messages.create({
model: primary,
max_tokens: maxTokens,
system: systemPrompt || '',
messages: [{ role: 'user', content: prompt }],
});
return { content: message.content[0].text, model: primary };
}
} catch (error) {
console.error('Primary failed, trying fallback:', error);
// Try fallback model...
}
}
4.2 Caching Strategy
// supabase/functions/\_shared/ai-cache.ts
export const CACHE_TTL_HOURS = {
syllabus_extraction: 168, // 1 week (syllabi don't change)
capability_analysis: 168, // 1 week
job_requirements: 24, // 1 day (job market changes)
gap_analysis: 1, // 1 hour (personalized)
recommendations: 1, // 1 hour (personalized)
};

async function generateCacheKey(task: string, input: string): Promise<string> {
const encoder = new TextEncoder();
const data = encoder.encode(`${task}:${input}`);
const hash = await crypto.subtle.digest('SHA-256', data);
return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getCachedResponse(supabase, task: string, input: string) {
const cacheKey = await generateCacheKey(task, input);
const { data } = await supabase
.from('ai_cache')
.select('response')
.eq('cache_key', cacheKey)
.gt('expires_at', new Date().toISOString())
.single();
return data?.response || null;
}

export async function setCachedResponse(supabase, task, input, response, model, cost) {
const cacheKey = await generateCacheKey(task, input);
const ttl = CACHE_TTL_HOURS[task] || 24;
const expiresAt = new Date(Date.now() + ttl _ 60 _ 60 \* 1000).toISOString();

await supabase.from('ai_cache').upsert({
cache_key: cacheKey,
task_type: task,
response,
model_used: model,
cost_usd: cost,
expires_at: expiresAt,
});
}

 
Part 5: Database Schema (Supabase)
5.1 Complete SQL Schema
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- USERS
CREATE TABLE public.users (
id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
email TEXT NOT NULL,
full_name TEXT,
university TEXT,
graduation_year INTEGER,
major TEXT,
student_level TEXT CHECK (student_level IN ('freshman','sophomore','junior','senior','graduate')),
onboarding_completed BOOLEAN DEFAULT FALSE,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COURSES
CREATE TABLE public.courses (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
name TEXT NOT NULL,
code TEXT,
university TEXT,
semester TEXT,
syllabus_text TEXT,
syllabus_file_url TEXT,
-- AI-generated fields (dynamic, not hardcoded)
capability_text TEXT,
capability_embedding VECTOR(1536),
key_capabilities JSONB DEFAULT '[]',
evidence_types JSONB DEFAULT '[]',
tools_methods JSONB DEFAULT '[]',
ai_model_used TEXT,
ai_cost_usd DECIMAL(10, 6),
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_courses_user_id ON public.courses(user_id);
CREATE INDEX idx_courses_embedding ON public.courses
USING ivfflat (capability_embedding vector_cosine_ops) WITH (lists = 100);

-- DREAM JOBS
CREATE TABLE public.dream_jobs (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
job_query TEXT NOT NULL, -- Free text, not dropdown
target_company_type TEXT,
target_location TEXT,
-- AI-generated
requirements_text TEXT,
requirements_embedding VECTOR(1536),
day_one_capabilities JSONB DEFAULT '[]',
differentiators JSONB DEFAULT '[]',
common_misconceptions JSONB DEFAULT '[]',
realistic_bar TEXT,
ai_model_used TEXT,
ai_cost_usd DECIMAL(10, 6),
is_active BOOLEAN DEFAULT TRUE,
created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CAPABILITY PROFILES (Aggregated)
CREATE TABLE public.capability_profiles (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
combined_capability_text TEXT,
combined_embedding VECTOR(1536),
capabilities_by_theme JSONB DEFAULT '{}',
course_count INTEGER DEFAULT 0,
last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- GAP ANALYSES
CREATE TABLE public.gap_analyses (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
dream_job_id UUID NOT NULL REFERENCES public.dream_jobs(id) ON DELETE CASCADE,
analysis_text TEXT NOT NULL,
strong_overlaps JSONB DEFAULT '[]',
critical_gaps JSONB DEFAULT '[]',
partial_overlaps JSONB DEFAULT '[]',
honest_assessment TEXT NOT NULL,
readiness_level TEXT,
interview_readiness TEXT,
job_success_prediction TEXT,
priority_gaps JSONB DEFAULT '[]',
ai_model_used TEXT,
ai_cost_usd DECIMAL(10, 6),
created_at TIMESTAMPTZ DEFAULT NOW(),
UNIQUE(user_id, dream_job_id)
);

-- RECOMMENDATIONS
CREATE TABLE public.recommendations (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
dream_job_id UUID NOT NULL REFERENCES public.dream_jobs(id) ON DELETE CASCADE,
gap_analysis_id UUID NOT NULL REFERENCES public.gap_analyses(id) ON DELETE CASCADE,
priority INTEGER NOT NULL,
gap_addressed TEXT NOT NULL,
action_title TEXT NOT NULL,
action_description TEXT NOT NULL,
why_this_matters TEXT NOT NULL,
steps JSONB DEFAULT '[]',
type TEXT CHECK (type IN ('project','course','certification','action','reading')),
effort_hours INTEGER,
cost DECIMAL(10, 2) DEFAULT 0,
evidence_created TEXT,
how_to_demonstrate TEXT,
resource_url TEXT,
resource_provider TEXT,
status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','skipped')),
ai_model_used TEXT,
ai_cost_usd DECIMAL(10, 6),
created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ANTI-RECOMMENDATIONS
CREATE TABLE public.anti_recommendations (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
dream_job_id UUID NOT NULL REFERENCES public.dream_jobs(id) ON DELETE CASCADE,
action TEXT NOT NULL,
reason TEXT NOT NULL,
created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI CACHE
CREATE TABLE public.ai_cache (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
cache_key TEXT UNIQUE NOT NULL,
task_type TEXT NOT NULL,
response TEXT NOT NULL,
model_used TEXT NOT NULL,
cost_usd DECIMAL(10, 6),
created_at TIMESTAMPTZ DEFAULT NOW(),
expires_at TIMESTAMPTZ NOT NULL
);

-- AI USAGE TRACKING
CREATE TABLE public.ai_usage (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
user_id UUID REFERENCES public.users(id),
task_type TEXT NOT NULL,
model_used TEXT NOT NULL,
input_tokens INTEGER NOT NULL,
output_tokens INTEGER NOT NULL,
cost_usd DECIMAL(10, 6) NOT NULL,
latency_ms INTEGER,
cached BOOLEAN DEFAULT FALSE,
created_at TIMESTAMPTZ DEFAULT NOW()
);

-- JOB REQUIREMENTS CACHE (common queries)
CREATE TABLE public.job_requirements_cache (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
job_query_normalized TEXT UNIQUE NOT NULL,
requirements_text TEXT NOT NULL,
requirements_embedding VECTOR(1536),
day_one_capabilities JSONB DEFAULT '[]',
differentiators JSONB DEFAULT '[]',
query_count INTEGER DEFAULT 1,
last_queried_at TIMESTAMPTZ DEFAULT NOW(),
created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dream_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gap_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own data" ON public.users FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users own courses" ON public.courses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own dream_jobs" ON public.dream_jobs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own capability_profiles" ON public.capability_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users own gap_analyses" ON public.gap_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users own recommendations" ON public.recommendations FOR ALL USING (auth.uid() = user_id);

 
Part 6: API Specification (Edge Functions)
6.1 analyze-syllabus
// supabase/functions/analyze-syllabus/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { executeAITask } from '../\_shared/ai-orchestrator.ts';
import { getCachedResponse, setCachedResponse } from '../\_shared/ai-cache.ts';
import { SYLLABUS_EXTRACTION_PROMPT, CAPABILITY_ANALYSIS_PROMPT } from '../\_shared/prompts.ts';

serve(async (req) => {
const { syllabus_text, course_name, university, student_level } = await req.json();

const supabase = createClient(
Deno.env.get('SUPABASE_URL')!,
Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Check cache
const cacheKey = `syllabus:${course_name}:${syllabus_text.substring(0, 500)}`;
const cached = await getCachedResponse(supabase, 'syllabus_extraction', cacheKey);
if (cached) return new Response(JSON.stringify({ ...JSON.parse(cached), cached: true }));

// Step 1: Extract structure (fast model)
const extraction = await executeAITask({
task: 'syllabus_extraction',
prompt: SYLLABUS_EXTRACTION_PROMPT
.replace('{{SYLLABUS}}', syllabus_text)
.replace('{{COURSE_NAME}}', course_name),
});

// Step 2: Analyze capabilities (reasoning model)
const analysis = await executeAITask({
task: 'capability_analysis',
prompt: CAPABILITY_ANALYSIS_PROMPT
.replace('{{EXTRACTED_CONTENT}}', extraction.content)
.replace('{{COURSE_NAME}}', course_name)
.replace('{{UNIVERSITY}}', university || 'Unknown'),
});

// Step 3: Generate embedding
const embedding = await executeAITask({
task: 'embedding',
prompt: analysis.content,
});

const result = {
capability_text: analysis.content,
embedding: JSON.parse(embedding.content),
key_capabilities: parseCapabilities(analysis.content),
ai_model_used: `${extraction.model},${analysis.model}`,
};

// Cache result
await setCachedResponse(supabase, 'syllabus_extraction', cacheKey, JSON.stringify(result), result.ai_model_used, 0.02);

return new Response(JSON.stringify(result));
});
6.2 analyze-dream-job
// supabase/functions/analyze-dream-job/index.ts
serve(async (req) => {
const { job_query, target_company_type } = await req.json();
const supabase = createClient(/_..._/);

// Check job requirements cache first
const normalized = job_query.toLowerCase().trim();
const { data: cached } = await supabase
.from('job_requirements_cache')
.select('\*')
.eq('job_query_normalized', normalized)
.single();

if (cached) {
await supabase.from('job_requirements_cache')
.update({ query_count: cached.query_count + 1, last_queried_at: new Date() })
.eq('id', cached.id);
return new Response(JSON.stringify({ ...cached, cached: true }));
}

// Generate with AI
const analysis = await executeAITask({
task: 'job_requirements',
prompt: JOB_REQUIREMENTS_PROMPT
.replace('{{JOB_QUERY}}', job_query)
.replace('{{COMPANY_TYPE}}', target_company_type || 'any'),
});

const embedding = await executeAITask({ task: 'embedding', prompt: analysis.content });
const parsed = parseJobRequirements(analysis.content);

// Cache for future users
await supabase.from('job_requirements_cache').insert({
job_query_normalized: normalized,
requirements_text: analysis.content,
requirements_embedding: JSON.parse(embedding.content),
...parsed,
});

return new Response(JSON.stringify({ requirements_text: analysis.content, ...parsed }));
});
6.3 generate-gap-analysis
// supabase/functions/generate-gap-analysis/index.ts
serve(async (req) => {
const { user_id, dream_job_id } = await req.json();
const supabase = createClient(/_..._/);

// Get user's capabilities
const { data: profile } = await supabase
.from('capability_profiles')
.select('combined_capability_text')
.eq('user_id', user_id)
.single();

// Get dream job requirements
const { data: dreamJob } = await supabase
.from('dream_jobs')
.select('job_query, requirements_text')
.eq('id', dream_job_id)
.single();

// Generate gap analysis (Claude for nuanced comparison)
const analysis = await executeAITask({
task: 'gap_analysis',
prompt: GAP_ANALYSIS_PROMPT
.replace('{{STUDENT_CAPABILITIES}}', profile.combined_capability_text)
.replace('{{JOB_REQUIREMENTS}}', dreamJob.requirements_text)
.replace('{{JOB_TITLE}}', dreamJob.job_query),
});

const parsed = parseGapAnalysis(analysis.content);

// Upsert gap analysis
const { data: saved } = await supabase
.from('gap_analyses')
.upsert({
user_id,
dream_job_id,
analysis_text: analysis.content,
...parsed,
ai_model_used: analysis.model,
}, { onConflict: 'user_id,dream_job_id' })
.select()
.single();

return new Response(JSON.stringify(saved));
});
6.4 generate-recommendations
// supabase/functions/generate-recommendations/index.ts
serve(async (req) => {
const { user_id, dream_job_id, gap_analysis_id, constraints } = await req.json();
const supabase = createClient(/_..._/);

const { data: gapAnalysis } = await supabase
.from('gap_analyses')
.select('\*')
.eq('id', gap_analysis_id)
.single();

const { data: dreamJob } = await supabase
.from('dream_jobs')
.select('job_query')
.eq('id', dream_job_id)
.single();

// Generate recommendations (Claude for actionable specificity)
const recs = await executeAITask({
task: 'recommendations',
prompt: RECOMMENDATIONS_PROMPT
.replace('{{GAP_ANALYSIS}}', gapAnalysis.analysis_text)
.replace('{{CRITICAL_GAPS}}', JSON.stringify(gapAnalysis.critical_gaps))
.replace('{{JOB_TITLE}}', dreamJob.job_query)
.replace('{{MAX_HOURS}}', String(constraints?.max_hours_per_week || 10))
.replace('{{BUDGET}}', String(constraints?.budget || 0))
.replace('{{TIMELINE}}', String(constraints?.timeline_weeks || 8)),
});

const parsed = parseRecommendations(recs.content);

// Delete old, insert new
await supabase.from('recommendations').delete().eq('user_id', user_id).eq('dream_job_id', dream_job_id);

const toInsert = parsed.recommendations.map((rec, i) => ({
user_id, dream_job_id, gap_analysis_id,
priority: i + 1,
...rec,
ai_model_used: recs.model,
}));

const { data: inserted } = await supabase.from('recommendations').insert(toInsert).select();

return new Response(JSON.stringify({ recommendations: inserted, what_not_to_do: parsed.what_not_to_do }));
});

 
Part 7: Complete Prompt Library
7.1 Master System Prompt
export const MASTER_SYSTEM_PROMPT = `You are the intelligence layer of EduThree.

CORE PRINCIPLES:

1. Be specific, not generic. Tailor to THIS student's situation.
2. Be honest, not encouraging. False confidence wastes time.
3. Describe capabilities, not credentials. "Can do X" > "took Y class"
4. Context matters. Same skill means different things in different roles.
5. Actionable over informative. Connect to "what should I do next?"

NEVER:

- Output percentage matches without context
- Give generic advice that applies to anyone
- Recommend without explaining why it addresses THEIR gap
- Sugarcoat weaknesses

ALWAYS:

- Reference specific capabilities from student profile
- Reference specific job requirements
- Explain the "why" behind assessments
- Be direct about competitive standing
- Provide concrete next steps with time/effort estimates`;
7.2 Syllabus Extraction Prompt
export const SYLLABUS_EXTRACTION_PROMPT = `Extract from this syllabus:

SYLLABUS: {{SYLLABUS}}
COURSE: {{COURSE_NAME}}

Extract:

1. LEARNING OBJECTIVES - What students will learn
2. TOPICS COVERED - Specific subjects/concepts
3. ASSIGNMENTS & PROJECTS - What students produce
4. TOOLS & SOFTWARE - Specific tools mentioned
5. READING MATERIALS - Textbooks/articles assigned
6. GRADING BREAKDOWN - How grade is distributed

Format as clear sections with bullets.
Do not add information not present in syllabus.`;
7.3 Capability Analysis Prompt
export const CAPABILITY_ANALYSIS_PROMPT = `Describe what a student can DO after this course.

EXTRACTED CONTENT: {{EXTRACTED_CONTENT}}
COURSE: {{COURSE_NAME}}
UNIVERSITY: {{UNIVERSITY}}

## CONCRETE CAPABILITIES

What specific tasks can they perform? Start each with "Can..."
BAD: "Can do financial analysis" (too vague)
GOOD: "Can build a 3-statement financial model linking income statement, balance sheet, and cash flow"

List 5-10 specific capabilities.

## TOOLS & METHODS PROFICIENCY

Specific tools/frameworks with proficiency level.
Example: "Excel: Intermediate (VLOOKUP, pivot tables, basic modeling)"

## EVIDENCE & ARTIFACTS

What tangible outputs would they have?
Example: "Written industry analysis report (5-10 pages)"

## CONTEXT & LIMITATIONS

What level of complexity can they handle?
What can they NOT do yet based on this course alone?`;
7.4 Job Requirements Prompt
export const JOB_REQUIREMENTS_PROMPT = `Describe what this role actually requires.

TARGET ROLE: {{JOB_QUERY}}
COMPANY TYPE: {{COMPANY_TYPE}}

## DAY ONE REQUIREMENTS

What must they do immediately? Can't learn on the job.
Be specific: "Can write SQL queries with JOINs"
Not: "Data-driven"

## DAILY WORK

What problems do they solve daily? What tools?

## DIFFERENTIATORS

What separates offers from rejections?

## COMMON MISCONCEPTIONS

What do candidates think matters but doesn't?

## REALISTIC BAR

For non-traditional background, what's competitive?

Don't soften requirements.`;
7.5 Gap Analysis Prompt
export const GAP_ANALYSIS_PROMPT = `Compare capabilities to requirements.

STUDENT CAPABILITIES: {{STUDENT_CAPABILITIES}}
JOB REQUIREMENTS ({{JOB_TITLE}}): {{JOB_REQUIREMENTS}}

## STRONG OVERLAPS

Where student meets/exceeds requirements?
Format: Student capability → Job requirement → Assessment

## CRITICAL GAPS

What would filter them out or cause failure?
Format: Job requirement → Student status → Impact

## PARTIAL OVERLAPS

Related experience but not exact fit?
Format: Area → Foundation → Missing

## HONEST ASSESSMENT

2-3 paragraphs:

1. Can they get interviews? At what companies?
2. Can they pass interviews? What trips them up?
3. Can they succeed? What would be hard?

## READINESS LEVEL

One clear statement.
Example: "Competitive for associate roles at non-tech. Not yet competitive for tech PM."

## PRIORITY GAPS

Top 2-3 gaps to close first if limited time.

"You're not ready" > false encouragement.`;
7.6 Recommendations Prompt
export const RECOMMENDATIONS_PROMPT = `Generate specific recommendations.

GAP ANALYSIS: {{GAP_ANALYSIS}}
CRITICAL GAPS: {{CRITICAL_GAPS}}
TARGET: {{JOB_TITLE}}

CONSTRAINTS:

- Time: {{MAX_HOURS}} hours/week
- Budget: ${{BUDGET}}
- Timeline: {{TIMELINE}} weeks

For each critical gap:

### Gap Addressed

[Quote from gap analysis]

### Action Title

Specific title (e.g., "Build a PRD for a real product")

### What To Do

Specific action with exact resource/platform.
BAD: "Learn SQL"
GOOD: "Complete Mode Analytics SQL tutorial (free). Focus on JOINs, aggregations."

### Why This Addresses Your Gap

Connect to specific gap. Why this action moves needle.

### Steps

Numbered concrete steps.

### Evidence Created

Tangible artifact for portfolio.

### How To Demonstrate

Exact language for interviews.

### Effort

Hours, difficulty, prerequisites.

### Cost

Free option always. Paid only if significantly better.

---

## WHAT NOT TO DO

2-3 things that seem helpful but waste time.

## TIMELINE

Week-by-week breakdown. When ready to apply.

## PRIORITY ORDER

If only ONE thing? TWO? THREE?

Generic advice = failed recommendation.`;

 
Part 8: Frontend Components & UI
8.1 Component Architecture
Category Components
Layout AppShell, Sidebar, Header, PageContainer
Auth LoginForm, SignupForm, AuthGuard
Onboarding OnboardingWizard, CourseUploader, DreamJobSelector
Dashboard DashboardOverview, CapabilitySnapshot, DreamJobCards
Analysis GapAnalysisView, HonestAssessment, GapsList
Recommendations RecommendationsList, RecommendationCard, ProgressTracker
Common LoadingState, ErrorBoundary, EmptyState
8.2 Key Component: HonestAssessment
// src/components/analysis/HonestAssessment.tsx
export function HonestAssessment({ assessment, readinessLevel, dreamJobTitle }) {
return (
<div className="bg-white border rounded-lg overflow-hidden">
<div className="bg-gray-50 px-6 py-4 border-b">
<h3 className="text-lg font-semibold">Your Path to: {dreamJobTitle}</h3>
</div>

      <div className="p-6">
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">
            Honest Assessment
          </h4>
          <div className="prose prose-sm text-gray-700">
            {assessment.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>

        {/* Highlighted Readiness Level */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-1">Current Status</h4>
          <p className="text-blue-900 font-medium">{readinessLevel}</p>
        </div>
      </div>
    </div>

);
}
8.3 Key Component: RecommendationCard
// src/components/recommendations/RecommendationCard.tsx
export function RecommendationCard({ recommendation }) {
const [expanded, setExpanded] = useState(false);
const updateStatus = useUpdateRecommendationStatus();

const priorityColors = {
1: 'bg-red-100 text-red-800',
2: 'bg-yellow-100 text-yellow-800',
3: 'bg-green-100 text-green-800',
};

return (
<div className="bg-white border rounded-lg">
<div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
<div className="flex items-start justify-between">
<div className="flex items-start space-x-3">
<span className={`px-2 py-1 text-xs font-medium rounded ${priorityColors[recommendation.priority]}`}>
#{recommendation.priority}
</span>
<div>
<h4 className="font-medium">{recommendation.action_title}</h4>
<p className="text-sm text-gray-500">Addresses: {recommendation.gap_addressed}</p>
</div>
</div>
<div className="flex items-center text-xs text-gray-500">
<Clock className="w-3 h-3 mr-1" />{recommendation.effort_hours}h
<span className="ml-2">{recommendation.cost === 0 ? 'Free' : `$${recommendation.cost}`}</span>
</div>
</div>

        {/* Status buttons */}
        <div className="mt-3 flex space-x-2">
          {['not_started', 'in_progress', 'completed'].map(status => (
            <button
              key={status}
              onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: recommendation.id, status }); }}
              className={`px-2 py-1 text-xs rounded-full ${recommendation.status === status ? 'bg-blue-100' : 'bg-gray-50'}`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {expanded && (
        <div className="border-t p-4 bg-gray-50 space-y-4">
          <div>
            <h5 className="text-sm font-medium mb-1">What To Do</h5>
            <p className="text-sm">{recommendation.action_description}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <h5 className="text-sm font-medium text-blue-800 mb-1">Why This Matters</h5>
            <p className="text-sm text-blue-700">{recommendation.why_this_matters}</p>
          </div>
          <div>
            <h5 className="text-sm font-medium mb-2">Steps</h5>
            <ol className="list-decimal list-inside space-y-1">
              {recommendation.steps.map((step, i) => <li key={i} className="text-sm">{step}</li>)}
            </ol>
          </div>
          {recommendation.resource_url && (
            <a href={recommendation.resource_url} target="_blank" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded">
              Start: {recommendation.resource_provider} <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          )}
        </div>
      )}
    </div>

);
}

 
Part 9: Workflow Orchestration
9.1 Complete User Journey
USER JOURNEY WORKFLOW

1. ONBOARDING
   User Sign Up → Add Courses (1+) → Add Dream Jobs (1-5) → Dashboard

   For each course:
   - Upload syllabus → Extract text → analyze-syllabus Edge Function
     - Gemini Flash: Extract structure
     - Gemini Pro: Analyze capabilities
     - OpenAI: Generate embedding
   - Save course → Update capability_profiles

   For each dream job:
   - Enter free text → Check job_requirements_cache
   - If not cached: Gemini Pro generates → Cache for future
   - Save dream job

2. GAP ANALYSIS
   Triggered: View dream job OR add new course
   - Aggregate user capabilities
   - Call generate-gap-analysis (Claude Sonnet)
   - Save to gap_analyses
   - Invalidate TanStack Query cache

3. RECOMMENDATIONS
   Triggered: After gap analysis OR user requests
   - Call generate-recommendations (Claude Sonnet)
   - Delete old recommendations
   - Insert new recommendations
   - Invalidate cache

4. DASHBOARD
   - useDashboard() → Overview stats
   - useDreamJobs() → List
   - useGapAnalyses() → Per job
   - usePriorityRecommendation() → Top action
     9.2 Cache Invalidation Rules
     Action Invalidates Reason
     Add course courses, dashboard, analysis New capabilities
     Delete course courses, dashboard, analysis Capabilities changed
     Add dream job dreamJobs, dashboard New job to track
     Update rec status recommendations, dashboard Progress changed
     Regenerate analysis analysis.gap, recommendations Fresh analysis

 
Part 10: Cost Optimization Strategy
10.1 Per-User Cost Analysis
Operation Model(s) Cost
Course analysis Flash + Pro + Embed ~$0.01-0.02
Dream job requirements Pro + Embed ~$0.005-0.01
Gap analysis Claude Sonnet ~$0.015-0.03
Recommendations Claude Sonnet ~$0.02-0.04
Total journey All ~$0.05-0.10
10.2 Cost Reduction Strategies

1. Aggressive Caching: Job requirements cached. After first 'Product Manager' query, subsequent queries hit cache. 60-70% reduction in job API calls.
2. Model Routing: Gemini Flash ($0.075/1M) for extraction vs Claude Sonnet ($3/1M) for reasoning = 40x difference for appropriate tasks.
3. Batch Processing: Multiple courses → single embedding API call.
4. Tiered Depth: Quick preview (Flash, $0.005) shown immediately. Full analysis (Sonnet, $0.03) on demand.
   10.3 Projected Costs at Scale
   Scale Monthly API Cost Per-User
   1,000 users $50-100 $0.05-0.10
   10,000 users $400-800 $0.04-0.08
   100,000 users $3,000-6,000 $0.03-0.06
   At 100K users with $3-5/student revenue = $300-500K vs ~$50K AI costs = 85%+ gross margin.

 
Part 11: Build Sequence (4-Week Sprint)
Week 1: Foundation
Day 1-2: Project Setup
• Create Vite + React + TypeScript project
• Install TanStack Query, Router, Form, Table
• Set up Tailwind + shadcn/ui
• Create Supabase project, run schema SQL
• Configure environment variables
Day 3-4: Authentication
• Implement Supabase Auth (email/password)
• Create Login/Signup pages
• Implement AuthGuard
• Test auth flow end-to-end
Day 5-7: AI Orchestration
• Create ai-orchestrator.ts
• Implement Gemini, Claude, OpenAI integrations
• Create model routing logic
• Implement caching layer
• Test each model independently
Week 2: Core Features
Day 1-2: Course Management
• Create analyze-syllabus Edge Function
• Implement PDF/DOCX text extraction
• Create AddCourseForm with TanStack Form
• Test with 5 real syllabi
Day 3-4: Dream Jobs
• Create analyze-dream-job Edge Function
• Implement job requirements caching
• Test with 10 different job queries
Day 5-7: Gap Analysis
• Create generate-gap-analysis Edge Function
• Create HonestAssessment component
• Create GapsList component
Week 3: Recommendations & Dashboard
Day 1-2: Recommendations
• Create generate-recommendations Edge Function
• Create RecommendationCard component
• Implement status tracking
Day 3-4: Dashboard
• Create DashboardOverview component
• Create CapabilitySnapshot component
• Implement dashboard aggregation
Day 5-7: Onboarding
• Create OnboardingWizard (multi-step)
• Create CourseUploader step
• Create DreamJobSelector step
Week 4: Polish & Launch
Day 1-2: Syllabus Scanner (Faculty)
• Create public SyllabusScannerPage
• Create scan-syllabus Edge Function
• Add pro tier upsell
Day 3-4: Testing
• End-to-end testing all flows
• Fix bugs, optimize performance
Day 5-6: Deployment
• Deploy frontend to Vercel
• Deploy Edge Functions to Supabase
• Set up Sentry monitoring
Day 7: Soft Launch
• Test with 20 real students
• Gather feedback, fix critical issues

 
Part 12: Deployment & Infrastructure
12.1 Vercel Configuration
// vercel.json
{
"buildCommand": "npm run build",
"outputDirectory": "dist",
"framework": "vite",
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
12.2 Supabase Storage Setup
-- Storage bucket for syllabi
INSERT INTO storage.buckets (id, name, public) VALUES ('syllabi', 'syllabi', false);

-- Users can upload own syllabi
CREATE POLICY "Users upload own" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'syllabi' AND auth.uid()::text = (storage.foldername(name))[1]);
12.3 Edge Functions Deployment

# Deploy functions

supabase functions deploy analyze-syllabus
supabase functions deploy analyze-dream-job
supabase functions deploy generate-gap-analysis
supabase functions deploy generate-recommendations

# Set secrets

supabase secrets set GOOGLE_AI_API_KEY=your_key
supabase secrets set ANTHROPIC_API_KEY=your_key
supabase secrets set OPENAI_API_KEY=your_key

 
Part 13: Testing Strategy
13.1 Test Categories
Category Tools
Unit Tests Vitest
Component Tests React Testing Library + Vitest
Integration Tests Playwright E2E
AI Output Tests Custom evaluation framework
13.2 AI Output Evaluation Criteria
const EVALUATION_CRITERIA = {
capability_analysis: {
min_capabilities: 5, // At least 5 "Can..." statements
requires_tools: true, // Must reference tools/methods
max_generic_phrases: 2, // No vague statements
},
gap_analysis: {
min_critical_gaps: 2, // At least 2 gaps identified
requires_honest_assessment: true,
forbid_naked_percentages: true, // No "58%" without context
},
recommendations: {
requires_steps: true, // Step-by-step instructions
requires_time_estimate: true,
requires_cost: true,
requires_reasoning: true, // "Why this matters"
},
};
Part 14: Success Metrics
14.1 Product Metrics
Metric Target
Onboarding completion > 60%
Courses per user > 3
Recommendation completion > 30%
Weekly active users > 40%
NPS score > 40
14.2 Technical Metrics
Metric Target
API response time (p95) < 3s for AI calls
Error rate < 1%
AI cost per user < $0.10
Cache hit rate > 50%
Uptime > 99.5%

 
Appendix A: Environment Variables

# Frontend (.env)

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SENTRY_DSN=your_sentry_dsn

# Supabase Edge Functions (secrets)

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GOOGLE_AI_API_KEY=your_google_ai_key
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
Appendix B: File Structure
eduthree/
├── src/
│ ├── components/
│ │ ├── analysis/ # HonestAssessment, GapsList, OverlapsList
│ │ ├── common/ # LoadingState, ErrorBoundary, EmptyState
│ │ ├── dashboard/ # DashboardOverview, DreamJobCard
│ │ ├── forms/ # AddCourseForm, AddDreamJobForm
│ │ ├── layout/ # AppShell, Sidebar, Header
│ │ ├── onboarding/ # OnboardingWizard, steps
│ │ └── recommendations/ # RecommendationCard, List
│ ├── hooks/ # useCourses, useDreamJobs, useAnalysis
│ ├── lib/ # query-client, query-keys, supabase
│ ├── pages/ # Dashboard, DreamJobDetail, etc.
│ ├── types/ # database.ts
│ ├── App.tsx
│ └── router.tsx
├── supabase/
│ ├── functions/
│ │ ├── \_shared/ # ai-orchestrator, prompts, cache
│ │ ├── analyze-syllabus/
│ │ ├── analyze-dream-job/
│ │ ├── generate-gap-analysis/
│ │ └── generate-recommendations/
│ └── migrations/
└── package.json
Appendix C: Seed Data
Job Postings (Manual Collection)
Collect 100 job postings per discipline from LinkedIn/Indeed:
Discipline Sample Titles
Business Business Analyst, Strategy Consultant
Marketing Marketing Manager, Brand Manager
Finance Financial Analyst, Investment Banking
Product Product Manager, Associate PM
Data Data Analyst, BI Analyst
Sample Syllabi
Collect 20 syllabi across disciplines for testing.

 
Document Control

Field Value
Document EduThree Technical Specification
Version 3.0
Date December 2025
Classification Confidential
Status Ready for Implementation

Revision History
Version Date Changes
1.0 Nov 2025 Initial B2C strategy
2.0 Dec 2025 Free-for-students model
3.0 Dec 2025 Complete tech spec with multi-model AI, TanStack

— END OF DOCUMENT —
