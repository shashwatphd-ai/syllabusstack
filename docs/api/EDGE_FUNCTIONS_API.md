# SyllabusStack Edge Functions API

## Overview

This document describes the Supabase Edge Functions that power SyllabusStack's backend operations.

## Authentication

All endpoints require a valid JWT token from Supabase Auth:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/function-name \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

## Core Functions

### Assessment System

#### `start-assessment`
Start a new assessment session for a learning objective.

**Request:**
```json
{
  "learning_objective_id": "uuid"
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "questions": [...],
  "timeout_at": "2024-01-28T12:00:00Z"
}
```

#### `submit-assessment-answer`
Submit an answer to an assessment question.

**Request:**
```json
{
  "session_id": "uuid",
  "question_id": "uuid",
  "answer": "string or number"
}
```

**Response:**
```json
{
  "is_correct": true,
  "explanation": "...",
  "next_question_index": 2
}
```

#### `complete-assessment`
Complete an assessment session and calculate results.

**Request:**
```json
{
  "session_id": "uuid"
}
```

**Response:**
```json
{
  "score": 85,
  "passed": true,
  "verified_skills": [...],
  "performance_summary": {...}
}
```

### Career System

#### `discover-dream-jobs`
Discover career opportunities based on user profile.

**Request:**
```json
{
  "interests": ["technology", "finance"],
  "education_level": "bachelors"
}
```

**Response:**
```json
{
  "discovered_careers": [
    {
      "onet_code": "15-1252.00",
      "title": "Software Developer",
      "match_score": 85
    }
  ]
}
```

#### `analyze-dream-job`
Analyze a dream job and create gap analysis.

**Request:**
```json
{
  "dream_job_id": "uuid"
}
```

**Response:**
```json
{
  "gap_analysis_id": "uuid",
  "skill_gaps": [...],
  "readiness_score": 72
}
```

#### `gap-analysis`
Generate detailed skill gap analysis.

**Request:**
```json
{
  "dream_job_id": "uuid",
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "overall_readiness": 65,
  "gaps": [
    {
      "skill": "Python",
      "current_level": "beginner",
      "required_level": "advanced",
      "gap_score": 60
    }
  ]
}
```

### Recommendation System

#### `generate-recommendations`
Generate learning recommendations for a dream job.

**Request:**
```json
{
  "dream_job_id": "uuid",
  "max_recommendations": 10
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "id": "uuid",
      "type": "course",
      "title": "Advanced Python",
      "priority": 1,
      "estimated_hours": 20
    }
  ]
}
```

### Content Management

#### `generate-curriculum`
Generate curriculum content for a course.

**Request:**
```json
{
  "course_id": "uuid",
  "syllabus_text": "..."
}
```

**Response:**
```json
{
  "modules": [...],
  "learning_objectives": [...],
  "estimated_hours": 40
}
```

#### `generate-lecture-slides-v3`
Generate lecture slides for a learning objective.

**Request:**
```json
{
  "learning_objective_id": "uuid",
  "content_type": "standard"
}
```

**Response:**
```json
{
  "slides": [...],
  "duration_minutes": 15
}
```

#### `generate-assessment-questions`
Generate assessment questions for a learning objective.

**Request:**
```json
{
  "learning_objective_id": "uuid",
  "count": 5
}
```

**Response:**
```json
{
  "questions": [
    {
      "id": "uuid",
      "question_text": "...",
      "question_type": "multiple_choice",
      "options": [...],
      "correct_answer": "0"
    }
  ]
}
```

### Instructor Functions

#### `send-student-message`
Send a message to a student.

**Request:**
```json
{
  "student_id": "uuid",
  "course_id": "uuid",
  "subject": "Course Progress Update",
  "message": "..."
}
```

**Response:**
```json
{
  "message_id": "uuid",
  "sent_at": "2024-01-28T10:00:00Z"
}
```

### Employer Functions

#### `employer-verify-completion`
Verify a student's course completion.

**Request:**
```json
{
  "certificate_id": "uuid"
}
```

**Response:**
```json
{
  "verified": true,
  "student_name": "John Doe",
  "course_title": "Advanced Python",
  "completion_date": "2024-01-15",
  "skills_verified": ["Python", "Data Analysis"]
}
```

#### `send-employer-webhook`
Send webhook notification to employer.

**Request:**
```json
{
  "employer_id": "uuid",
  "event_type": "verification_completed",
  "data": {...}
}
```

**Response:**
```json
{
  "success": true,
  "webhook_id": "uuid"
}
```

## Rate Limiting

All endpoints are rate limited based on user tier:

| Tier | Requests/Hour | Requests/Day | Cost/Day |
|------|---------------|--------------|----------|
| Free | 50 | 200 | $10 |
| Pro | 50 | 500 | $5 |
| Enterprise | 1000 | 10000 | $100 |

Rate limit headers:
- `X-RateLimit-Remaining-Hourly`
- `X-RateLimit-Remaining-Daily`
- `Retry-After` (when limited)

## Error Responses

All errors follow this format:

```json
{
  "error": "Error type",
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "details": {...}
}
```

Common error codes:
- `RATE_LIMIT_EXCEEDED` - 429
- `UNAUTHORIZED` - 401
- `NOT_FOUND` - 404
- `VALIDATION_ERROR` - 400
- `INTERNAL_ERROR` - 500

## Webhooks

Employers can configure webhooks for events:

| Event | Description |
|-------|-------------|
| `verification_completed` | Student verification completed |
| `certificate_issued` | New certificate issued |
| `skill_verified` | New skill verified |

Webhook payload:
```json
{
  "event": "verification_completed",
  "timestamp": "2024-01-28T10:00:00Z",
  "data": {...}
}
```
