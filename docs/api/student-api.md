# Student API

Student-facing endpoints for learning, assessments, and progress tracking.

## Assessment Endpoints

### Start Assessment
Begin an assessment session for a learning objective.

```http
POST /start-assessment
```

**Request Body:**
```json
{
  "learning_objective_id": "uuid",
  "num_questions": 5
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "status": "in_progress",
    "question_ids": ["uuid1", "uuid2"],
    "timeout_at": "2026-02-02T12:30:00Z"
  },
  "questions": [...],
  "is_resumed": false,
  "timeout_minutes": 30
}
```

### Submit Assessment Answer
Submit an answer for a question in an active session.

```http
POST /submit-assessment-answer
```

**Request Body:**
```json
{
  "session_id": "uuid",
  "question_id": "uuid",
  "user_answer": "The answer text",
  "client_question_served_at": "2026-02-02T12:00:00Z",
  "client_answer_submitted_at": "2026-02-02T12:01:30Z"
}
```

**Response:**
```json
{
  "success": true,
  "is_correct": true,
  "evaluation_method": "keyword_match",
  "time_taken_seconds": 90,
  "timing_flags": [],
  "session_progress": {
    "questions_answered": 3,
    "questions_correct": 2,
    "total_questions": 5,
    "current_score": 66.67,
    "is_complete": false
  }
}
```

### Complete Assessment
Finish an assessment session and get final results.

```http
POST /complete-assessment
```

**Request Body:**
```json
{
  "session_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "uuid",
    "status": "completed",
    "total_score": 80,
    "passed": true
  },
  "performance": {
    "total_questions": 5,
    "questions_answered": 5,
    "questions_correct": 4,
    "questions_incorrect": 1,
    "questions_skipped": 0,
    "total_score": 80,
    "passed": true,
    "passing_threshold": 70,
    "total_time_seconds": 450,
    "avg_time_per_question": 90
  },
  "learning_objective_verified": true
}
```

## Skills Assessment Endpoints

### Start Skills Assessment
Begin a skills assessment for career matching.

```http
POST /start-skills-assessment
```

**Request Body:**
```json
{
  "skill_names": ["Python", "Data Analysis", "Machine Learning"],
  "assessment_type": "comprehensive"
}
```

### Submit Skills Response
Submit a response in the skills assessment.

```http
POST /submit-skills-response
```

**Request Body:**
```json
{
  "session_id": "uuid",
  "question_id": "uuid",
  "response": "Response text",
  "time_taken_seconds": 45
}
```

### Complete Skills Assessment
Finish skills assessment and get career recommendations.

```http
POST /complete-skills-assessment
```

## Career Endpoints

### Discover Dream Jobs
Get AI-powered job recommendations based on profile.

```http
POST /discover-dream-jobs
```

**Request Body:**
```json
{
  "interests": "technology, data science",
  "skills": "python, sql, machine learning",
  "major": "Computer Science",
  "careerGoals": "Become a data scientist",
  "workStyle": "remote, collaborative"
}
```

### Gap Analysis
Analyze skill gaps for a target career.

```http
POST /gap-analysis
```

**Request Body:**
```json
{
  "dreamJobId": "uuid"
}
```

### Match Careers
Find career matches based on assessed skills.

```http
POST /match-careers
```

**Request Body:**
```json
{
  "limit": 20,
  "filters": {
    "min_education_level": "bachelors",
    "min_salary": 50000
  }
}
```

## Content Consumption

### Track Consumption
Track video/content consumption progress.

```http
POST /track-consumption
```

**Request Body:**
```json
{
  "content_id": "uuid",
  "learning_objective_id": "uuid",
  "event": {
    "type": "play",
    "timestamp": 1609459200,
    "video_time": 120
  },
  "current_segments": [
    {"start": 0, "end": 120}
  ],
  "total_duration": 600
}
```

**Event Types:** `play`, `pause`, `seek`, `speed_change`, `tab_focus_loss`, `complete`

## Enrollment

### Enroll in Course
Enroll in an instructor course using access code.

```http
POST /enroll-in-course
```

**Request Body:**
```json
{
  "access_code": "ABC123",
  "promo_code": "DISCOUNT10"
}
```

## Search

### Global Search
Search across courses, content, and learning objectives.

```http
POST /global-search
```

**Request Body:**
```json
{
  "query": "machine learning basics",
  "categories": ["courses", "content"],
  "limit": 10
}
```
