# Authentication

SyllabusStack uses Supabase Auth for authentication, providing JWT-based security for all API endpoints.

## Authentication Methods

### Email/Password

**Sign Up:**
```bash
curl -X POST 'https://[project].supabase.co/auth/v1/signup' \
  -H 'apikey: [anon-key]' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

**Sign In:**
```bash
curl -X POST 'https://[project].supabase.co/auth/v1/token?grant_type=password' \
  -H 'apikey: [anon-key]' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "xxx-xxx-xxx",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "authenticated"
  }
}
```

### Magic Link

**Request Magic Link:**
```bash
curl -X POST 'https://[project].supabase.co/auth/v1/magiclink' \
  -H 'apikey: [anon-key]' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com"
  }'
```

### OAuth Providers

Supported providers:
- Google
- GitHub
- Microsoft (via SSO)

**Initiate OAuth:**
```bash
curl -X GET 'https://[project].supabase.co/auth/v1/authorize?provider=google&redirect_to=https://app.syllabusstack.com/auth/callback'
```

## Password Requirements

Passwords must meet the following criteria:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*(),.?":{}|<>)

## Token Management

### Refresh Token
```bash
curl -X POST 'https://[project].supabase.co/auth/v1/token?grant_type=refresh_token' \
  -H 'apikey: [anon-key]' \
  -H 'Content-Type: application/json' \
  -d '{
    "refresh_token": "xxx-xxx-xxx"
  }'
```

### Sign Out
```bash
curl -X POST 'https://[project].supabase.co/auth/v1/logout' \
  -H 'apikey: [anon-key]' \
  -H 'Authorization: Bearer [access-token]'
```

## Using Access Tokens

Include the access token in all API requests:

```bash
curl -X POST 'https://[project].supabase.co/functions/v1/[endpoint]' \
  -H 'Authorization: Bearer [access-token]' \
  -H 'Content-Type: application/json' \
  -d '{...}'
```

## User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `student` | Default role | Learning, assessments, progress |
| `instructor` | Verified instructor | Course creation, content management |
| `employer` | Employer account | Credential verification |
| `admin` | Platform admin | Full access |
| `org_admin` | Organization admin | Org-level management |

## Email Verification

New users receive a verification email. Unverified users have limited access.

**Resend Verification:**
```bash
curl -X POST 'https://[project].supabase.co/auth/v1/resend' \
  -H 'apikey: [anon-key]' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "signup",
    "email": "user@example.com"
  }'
```

## Password Reset

**Request Reset:**
```bash
curl -X POST 'https://[project].supabase.co/auth/v1/recover' \
  -H 'apikey: [anon-key]' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com"
  }'
```

**Update Password (with recovery token):**
```bash
curl -X PUT 'https://[project].supabase.co/auth/v1/user' \
  -H 'apikey: [anon-key]' \
  -H 'Authorization: Bearer [recovery-token]' \
  -H 'Content-Type: application/json' \
  -d '{
    "password": "NewSecurePassword123!"
  }'
```

## Session Management

Sessions expire after 1 hour by default. Use refresh tokens to maintain long-lived sessions.

**Client-Side (JavaScript):**
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Auto-refresh is handled by the client
const { data: { session } } = await supabase.auth.getSession()
```

## Rate Limiting

Authentication endpoints have rate limits:
- Sign up: 3 requests per hour per email
- Sign in: 10 attempts per minute per IP
- Password reset: 3 requests per hour per email
