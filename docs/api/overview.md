# SyllabusStack API Documentation

## Overview

SyllabusStack provides a comprehensive REST API built on Supabase Edge Functions. All endpoints are authenticated via Supabase Auth JWT tokens unless otherwise specified.

## Base URL

```
Production: https://[your-project].supabase.co/functions/v1
Development: http://localhost:54321/functions/v1
```

## Authentication

All API requests require a Bearer token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

Tokens are obtained through Supabase Auth:
- Email/Password login
- Magic link
- OAuth providers (Google, GitHub)

## Rate Limiting

AI-powered endpoints are rate-limited based on subscription tier:

| Tier | Requests/Hour | Concurrent |
|------|---------------|------------|
| Free | 10 | 2 |
| Pro | 100 | 10 |
| Enterprise | 1000 | 50 |

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

## Response Format

All endpoints return JSON with a consistent structure:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-02-02T12:00:00Z"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "learning_objective_id is required"
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## API Categories

1. [Authentication](./authentication.md) - User auth and session management
2. [Student API](./student-api.md) - Learning, assessments, progress
3. [Instructor API](./instructor-api.md) - Course creation, content management
4. [Employer API](./employer-api.md) - Credential verification, webhooks
5. [Admin API](./admin-api.md) - User management, analytics
6. [Webhooks](./webhooks.md) - Event notifications

## Quick Start

### 1. Authenticate
```bash
curl -X POST 'https://[project].supabase.co/auth/v1/token?grant_type=password' \
  -H 'apikey: [anon-key]' \
  -H 'Content-Type: application/json' \
  -d '{"email": "user@example.com", "password": "password"}'
```

### 2. Make API Call
```bash
curl -X POST 'https://[project].supabase.co/functions/v1/start-assessment' \
  -H 'Authorization: Bearer [jwt-token]' \
  -H 'Content-Type: application/json' \
  -d '{"learning_objective_id": "uuid-here", "num_questions": 5}'
```

## CORS

All endpoints support CORS for browser-based requests:
- Allowed origins: Production domain, localhost:5173
- Allowed methods: GET, POST, OPTIONS
- Allowed headers: Authorization, Content-Type, x-client-info, apikey
