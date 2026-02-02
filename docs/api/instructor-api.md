# Instructor API

Instructor-facing endpoints for course creation, content management, and analytics.

## Content Generation

### Generate Lecture Slides
Generate AI-powered lecture slides for a teaching unit.

```http
POST /generate-lecture-slides-v3
```

**Request Body:**
```json
{
  "teaching_unit_id": "uuid",
  "style": "detailed",
  "regenerate": false
}
```

**Response:**
```json
{
  "success": true,
  "slides": [...],
  "teaching_unit_id": "uuid",
  "slide_count": 12,
  "regenerated": false
}
```

### Generate Lecture Audio
Generate text-to-speech audio for slides.

```http
POST /generate-lecture-audio
```

**Request Body:**
```json
{
  "slideId": "uuid",
  "voice": "en-US-Neural2-D",
  "enableSSML": true,
  "enableSegmentMapping": true
}
```

### Generate Assessment Questions
Generate AI-powered assessment questions.

```http
POST /generate-assessment-questions
```

**Request Body:**
```json
{
  "learning_objective_id": "uuid",
  "count": 5,
  "difficulty": "medium"
}
```

### Generate Micro-Checks
Generate in-video comprehension checks.

```http
POST /generate-micro-checks
```

**Request Body:**
```json
{
  "content_id": "uuid",
  "learning_objective_id": "uuid",
  "content_title": "Introduction to ML",
  "duration_seconds": 600,
  "learning_objective_text": "Explain supervised learning",
  "num_checks": 3
}
```

## Content Search & Curation

### Search YouTube Content
Search for educational videos matching learning objectives.

```http
POST /search-youtube-content
```

**Request Body:**
```json
{
  "learning_objective_id": "uuid",
  "core_concept": "supervised learning",
  "bloom_level": "understand",
  "use_ai_evaluation": true,
  "sources": ["invidious", "piped", "khan_academy"]
}
```

### Add Manual Content
Manually add content to a learning objective.

```http
POST /add-manual-content
```

**Request Body:**
```json
{
  "learning_objective_id": "uuid",
  "video_id": "dQw4w9WgXcQ",
  "video_title": "Introduction to ML",
  "source_type": "youtube",
  "duration_seconds": 600
}
```

### Add Instructor Content
Add custom content by URL.

```http
POST /add-instructor-content
```

**Request Body:**
```json
{
  "url": "https://youtube.com/watch?v=abc123",
  "learning_objective_id": "uuid",
  "custom_title": "My Custom Title",
  "auto_approve": true
}
```

## Syllabus Processing

### Analyze Syllabus
AI analysis of uploaded syllabus document.

```http
POST /analyze-syllabus
```

**Request Body:**
```json
{
  "course_id": "uuid",
  "syllabus_text": "Course content here..."
}
```

### Process Syllabus
Process and structure syllabus into modules/LOs.

```http
POST /process-syllabus
```

### Extract Learning Objectives
Extract learning objectives from text.

```http
POST /extract-learning-objectives
```

**Request Body:**
```json
{
  "course_id": "uuid",
  "module_text": "Module description..."
}
```

## Curriculum Generation

### Generate Curriculum
Generate AI-powered curriculum for a career path.

```http
POST /generate-curriculum
```

**Request Body:**
```json
{
  "career_match_id": "uuid",
  "customizations": {
    "hours_per_week": 10,
    "learning_style": "visual",
    "priority_skills": ["Python", "SQL"]
  }
}
```

### Generate Content Strategy
Generate content search strategy for an LO.

```http
POST /generate-content-strategy
```

**Request Body:**
```json
{
  "teaching_unit_id": "uuid",
  "force_regenerate": false
}
```

## Student Management

### Send Student Message
Send a message to enrolled students.

```http
POST /send-student-message
```

**Request Body:**
```json
{
  "student_ids": ["uuid1", "uuid2"],
  "course_id": "uuid",
  "message": "Reminder: Assignment due tomorrow",
  "subject": "Assignment Reminder"
}
```

## Instructor Verification

### Verify Instructor Email
Submit instructor verification request.

```http
POST /verify-instructor-email
```

**Request Body:**
```json
{
  "email": "professor@university.edu",
  "institution_name": "State University",
  "department": "Computer Science",
  "title": "Associate Professor",
  "linkedin_url": "https://linkedin.com/in/professor"
}
```

### Review Instructor Verification (Admin)
Review and approve/reject verification request.

```http
POST /review-instructor-verification
```

**Request Body:**
```json
{
  "verification_id": "uuid",
  "action": "approve",
  "trust_score_adjustment": 10
}
```

## Batch Operations

### Submit Batch Curriculum
Submit batch curriculum generation job.

```http
POST /submit-batch-curriculum
```

### Submit Batch Evaluation
Submit batch content evaluation job.

```http
POST /submit-batch-evaluation
```

### Poll Batch Status
Check status of a batch job.

```http
POST /poll-batch-status
```

**Request Body:**
```json
{
  "batch_id": "uuid"
}
```

### Cancel Batch Job
Cancel a running batch job.

```http
POST /cancel-batch-job
```

**Request Body:**
```json
{
  "batch_id": "uuid"
}
```
