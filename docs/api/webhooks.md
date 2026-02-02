# Webhooks

SyllabusStack provides webhooks to notify external systems of events in real-time.

## Overview

Webhooks allow you to:
- Receive real-time notifications of credential events
- Integrate with HR systems and applicant tracking systems
- Build custom workflows based on student progress

## Setting Up Webhooks

### Create Webhook Endpoint

```http
POST /create-webhook
```

**Request:**
```json
{
  "employer_account_id": "uuid",
  "url": "https://api.yourcompany.com/webhooks/syllabusstack",
  "events": ["credential.issued", "credential.revoked", "skill.verified"]
}
```

**Response:**
```json
{
  "success": true,
  "webhook": {
    "id": "wh_xxxxx",
    "url": "https://api.yourcompany.com/webhooks/syllabusstack",
    "secret": "whsec_xxxxx",
    "events": ["credential.issued", "credential.revoked", "skill.verified"],
    "status": "active",
    "created_at": "2026-02-02T12:00:00Z"
  }
}
```

**Important:** Save the `secret` securely - it's only shown once!

## Available Events

### Credential Events

| Event | Description |
|-------|-------------|
| `credential.issued` | A new certificate has been issued |
| `credential.revoked` | A certificate has been revoked |
| `credential.verified` | An employer verified a credential |

### Skill Events

| Event | Description |
|-------|-------------|
| `skill.verified` | A skill has been verified through assessment |
| `skill.updated` | A skill proficiency level changed |

### Enrollment Events

| Event | Description |
|-------|-------------|
| `enrollment.created` | A student enrolled in a course |
| `enrollment.completed` | A student completed a course |
| `enrollment.progress` | Significant progress milestone reached |

## Webhook Payload Format

All webhooks follow this structure:

```json
{
  "id": "evt_xxxxx",
  "event": "credential.issued",
  "api_version": "2026-02-01",
  "created": 1609459200,
  "data": {
    // Event-specific data
  }
}
```

## Event Payloads

### credential.issued

```json
{
  "id": "evt_xxxxx",
  "event": "credential.issued",
  "created": 1609459200,
  "data": {
    "credential_id": "cred_xxxxx",
    "student": {
      "id": "uuid",
      "email": "student@example.com",
      "name": "John Doe"
    },
    "course": {
      "id": "uuid",
      "title": "Introduction to Data Science",
      "institution": "State University"
    },
    "certificate_type": "verified",
    "issued_at": "2026-02-02T12:00:00Z",
    "skills": ["Python", "Data Analysis", "SQL"],
    "mastery_score": 85,
    "verification_url": "https://app.syllabusstack.com/verify/cred_xxxxx"
  }
}
```

### credential.revoked

```json
{
  "id": "evt_xxxxx",
  "event": "credential.revoked",
  "created": 1609459200,
  "data": {
    "credential_id": "cred_xxxxx",
    "reason": "academic_integrity_violation",
    "revoked_at": "2026-02-02T12:00:00Z",
    "revoked_by": "admin"
  }
}
```

### skill.verified

```json
{
  "id": "evt_xxxxx",
  "event": "skill.verified",
  "created": 1609459200,
  "data": {
    "student": {
      "id": "uuid",
      "email": "student@example.com"
    },
    "skill": {
      "name": "Python Programming",
      "category": "Programming Languages"
    },
    "proficiency_level": "advanced",
    "score": 92,
    "verification_source": "assessment",
    "verified_at": "2026-02-02T12:00:00Z"
  }
}
```

## Webhook Security

### Signature Verification

All webhook payloads are signed using HMAC-SHA256. The signature is sent in the `X-Signature-256` header.

**Verification (Python):**
```python
import hmac
import hashlib

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode('utf-8'),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)

# Usage
payload = request.body
signature = request.headers['X-Signature-256']
if not verify_webhook(payload, signature, WEBHOOK_SECRET):
    return Response(status=401)
```

**Verification (Node.js):**
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}
```

### Timestamp Validation

Prevent replay attacks by checking the timestamp:

```python
import time

def is_recent(timestamp: int, tolerance_seconds: int = 300) -> bool:
    return abs(time.time() - timestamp) < tolerance_seconds
```

## Best Practices

### 1. Respond Quickly

Return a `200 OK` response immediately, then process asynchronously:

```python
@app.route('/webhook', methods=['POST'])
def handle_webhook():
    # Verify signature first
    if not verify_webhook(request.data, request.headers['X-Signature-256'], SECRET):
        return '', 401

    # Queue for async processing
    queue.enqueue(process_webhook, request.json)

    return '', 200
```

### 2. Handle Retries

Webhooks are retried on failure:
- 1st retry: 1 minute
- 2nd retry: 5 minutes
- 3rd retry: 30 minutes
- 4th retry: 2 hours
- 5th retry: 24 hours

Implement idempotency using the event `id`:

```python
processed_events = set()

def process_webhook(event):
    if event['id'] in processed_events:
        return  # Already processed

    processed_events.add(event['id'])
    # Process event...
```

### 3. Log Everything

Log all webhook events for debugging:

```python
import logging

logger = logging.getLogger('webhooks')

def handle_webhook(event):
    logger.info(f"Received webhook: {event['event']} ({event['id']})")
    try:
        process_event(event)
        logger.info(f"Processed webhook: {event['id']}")
    except Exception as e:
        logger.error(f"Webhook error: {event['id']} - {str(e)}")
        raise
```

## Testing Webhooks

Use our webhook testing tool in the developer dashboard to:
- Send test events to your endpoint
- View delivery logs
- Debug failed deliveries

**Test Event:**
```bash
curl -X POST 'https://[project].supabase.co/functions/v1/send-employer-webhook' \
  -H 'Authorization: Bearer [admin-token]' \
  -H 'Content-Type: application/json' \
  -d '{
    "webhook_id": "wh_xxxxx",
    "test": true,
    "event": "credential.issued"
  }'
```

## Webhook Management

### List Webhooks

```http
GET /webhooks
```

### Update Webhook

```http
PATCH /webhooks/{id}
```

### Delete Webhook

```http
DELETE /webhooks/{id}
```

### View Delivery Logs

```http
GET /webhooks/{id}/deliveries
```
