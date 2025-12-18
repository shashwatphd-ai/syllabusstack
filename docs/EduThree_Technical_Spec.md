# EduThree Technical Specification v3.0

## Overview
EduThree is an AI-native career navigation platform that helps students understand their job-readiness through intelligent analysis of their coursework against real job market requirements.

## Core Philosophy
- **Nothing is hardcoded** - No fixed skill taxonomies, no predetermined job lists
- **AI does the thinking** - Claude/Gemini analyzes, matches, and recommends
- **Honesty over encouragement** - Realistic assessments, not empty percentages
- **Specificity is required** - Generic advice fails, specific guidance succeeds

## Technology Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript |
| State Management | TanStack Query (React Query v5) |
| Routing | React Router |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| AI Primary | Google Vertex AI (Gemini 1.5 Pro/Flash) |
| AI Secondary | Anthropic Claude (Claude 3.5 Sonnet) |
| AI Embeddings | OpenAI (text-embedding-3-small) |

## Database Schema

### Core Tables
- `users` - User profiles with university/major info
- `courses` - Uploaded courses with AI-analyzed capabilities
- `dream_jobs` - Target jobs with AI-generated requirements
- `gap_analyses` - AI comparison of capabilities vs requirements
- `recommendations` - Specific actionable steps to close gaps

### Key Features
- pgvector for semantic search
- RLS policies for data security
- AI response caching

## User Journey
1. **Onboarding**: Sign up → Add Courses (upload syllabi) → Add Dream Jobs → Dashboard
2. **Gap Analysis**: AI compares capabilities to job requirements
3. **Recommendations**: Specific, actionable steps with time/cost estimates
4. **Progress Tracking**: Mark recommendations as completed

## Edge Functions
- `analyze-syllabus` - Extract capabilities from course syllabi
- `analyze-dream-job` - Generate job requirements from job titles
- `generate-gap-analysis` - Compare capabilities to requirements
- `generate-recommendations` - Create actionable improvement plans

## AI Prompting Principles
- Be specific, not generic
- Be honest, not encouraging
- Describe capabilities, not credentials
- Context matters
- Actionable over informative

## Business Model
| Revenue Source | Price Point | Why They Pay |
|---------------|-------------|--------------|
| University Licenses | $3-5/student/year | Career services needs outcomes data |
| Employer Sponsorships | $500-2,000/month | Access to qualified talent pool |
| Affiliate Commissions | 20-40% | Coursera/Udemy pay for qualified leads |

## Component Architecture
| Category | Components |
|----------|-----------|
| Layout | AppShell, Sidebar, Header, PageContainer |
| Auth | LoginForm, SignupForm, AuthGuard |
| Onboarding | OnboardingWizard, CourseUploader, DreamJobSelector |
| Dashboard | DashboardOverview, CapabilitySnapshot, DreamJobCards |
| Analysis | GapAnalysisView, HonestAssessment, GapsList |
| Recommendations | RecommendationsList, RecommendationCard, ProgressTracker |

## Build Sequence (4-Week Sprint)
- **Week 1**: Foundation (Setup, Auth, AI Orchestration)
- **Week 2**: Core Features (Courses, Dream Jobs, Gap Analysis)
- **Week 3**: Recommendations & Dashboard
- **Week 4**: Polish & Launch
