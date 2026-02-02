# Admin API

Administrative endpoints for user management, analytics, and system configuration.

## Organization Management

### Invite Users
Invite users to an organization.

```http
POST /invite-users
```

**Request Body:**
```json
{
  "emails": ["user1@example.com", "user2@example.com"],
  "role": "member",
  "organization_id": "uuid"
}
```

**Roles:** `member`, `admin`, `instructor`

### Remove Organization User
Remove a user from an organization.

```http
POST /remove-org-user
```

**Request Body:**
```json
{
  "userId": "uuid"
}
```

### Use Invite Code
Accept an organization invite.

```http
POST /use-invite-code
```

**Request Body:**
```json
{
  "code": "INV-ABC123"
}
```

## SSO Configuration

### Configure Organization SSO
Set up single sign-on for an organization.

```http
POST /configure-organization-sso
```

**Request Body:**
```json
{
  "organization_id": "uuid",
  "provider": "okta",
  "metadata_url": "https://company.okta.com/.well-known/openid-configuration",
  "client_id": "xxxxx",
  "client_secret": "xxxxx"
}
```

**Providers:** `google`, `microsoft`, `okta`, `custom`

## Usage & Analytics

### Get Usage Stats
Retrieve usage statistics for admin dashboard.

```http
GET /get-usage-stats
```

**Query Parameters:**
- `start_date`: ISO date string
- `end_date`: ISO date string
- `organization_id`: Filter by org (optional)

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_users": 1500,
    "active_users_30d": 850,
    "total_enrollments": 3200,
    "completed_courses": 1100,
    "ai_requests": 25000,
    "certificates_issued": 450
  },
  "trends": {
    "user_growth": 12.5,
    "enrollment_growth": 8.3,
    "completion_rate": 68.7
  }
}
```

### Get Invoices
Retrieve billing invoices.

```http
GET /get-invoices
```

**Response:**
```json
{
  "success": true,
  "invoices": [
    {
      "id": "inv_xxxxx",
      "amount": 9900,
      "currency": "usd",
      "status": "paid",
      "created_at": "2026-01-01T00:00:00Z",
      "pdf_url": "https://..."
    }
  ]
}
```

## Subscription Management

### Create Checkout Session
Create a Stripe checkout session for subscription.

```http
POST /create-checkout-session
```

**Request Body:**
```json
{
  "price_id": "price_xxxxx",
  "success_url": "https://app.syllabusstack.com/success",
  "cancel_url": "https://app.syllabusstack.com/pricing",
  "mode": "subscription"
}
```

### Create Portal Session
Create a Stripe billing portal session.

```http
POST /create-portal-session
```

**Response:**
```json
{
  "success": true,
  "url": "https://billing.stripe.com/session/xxxxx"
}
```

### Cancel Subscription
Cancel an active subscription.

```http
POST /cancel-subscription
```

## Proctoring

### Record Proctor Event
Record a proctoring event during assessment.

```http
POST /record-proctor-event
```

**Request Body:**
```json
{
  "assessment_session_id": "uuid",
  "event_type": "tab_switch",
  "details": {
    "count": 1,
    "timestamp": 1609459200
  }
}
```

**Event Types:**
- `fullscreen_exit`: User exited fullscreen mode
- `tab_switch`: User switched browser tabs
- `copy_paste`: Copy/paste detected
- `keyboard_shortcut`: Suspicious keyboard shortcut
- `focus_loss`: Browser window lost focus

## Email Notifications

### Send Digest Email
Trigger digest email for users (admin/cron).

```http
POST /send-digest-email
```

**Note:** This endpoint is typically called by scheduled jobs.

## Job Search (Admin Tools)

### Search Jobs
Search job postings for career matching.

```http
POST /search-jobs
```

**Request Body:**
```json
{
  "title": "Software Engineer",
  "location": "Remote",
  "skills": ["Python", "React"],
  "limit": 20
}
```

### Scrape Job Posting
Extract details from a job posting URL.

```http
POST /scrape-job-posting
```

**Request Body:**
```json
{
  "url": "https://linkedin.com/jobs/view/123456"
}
```

**Allowed Domains:**
- linkedin.com
- indeed.com
- glassdoor.com
- greenhouse.io
- lever.co
- workday.com
- careers.google.com

## O*NET Integration

### Get O*NET Occupation
Retrieve occupation details from O*NET database.

```http
GET /get-onet-occupation
```

**Query Parameters:**
- `code`: O*NET SOC code (e.g., "15-1252.00")
