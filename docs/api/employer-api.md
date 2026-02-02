# Employer API

Employer-facing endpoints for credential verification and integration.

## Credential Verification

### Verify Certificate
Verify a student's certificate credential.

```http
POST /verify-certificate
```

**Request Body (by credential ID):**
```json
{
  "credential_id": "uuid"
}
```

**Request Body (by verification code):**
```json
{
  "verification_code": "ABC123XYZ"
}
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "credential": {
    "id": "uuid",
    "type": "verified",
    "course_title": "Introduction to Data Science",
    "student_name": "John Doe",
    "issued_at": "2026-01-15T00:00:00Z",
    "skills": ["Python", "Data Analysis", "SQL"],
    "mastery_score": 85,
    "institution": "State University",
    "instructor": "Dr. Jane Smith"
  },
  "blockchain_anchor": {
    "tx_hash": "0x...",
    "verified": true
  }
}
```

### Employer Verify Completion
Verify a student's course completion status.

```http
POST /employer-verify-completion
```

**Request Body:**
```json
{
  "credential_id": "uuid",
  "student_email": "student@email.com"
}
```

## Webhooks

### Create Webhook
Register a webhook endpoint for credential events.

```http
POST /create-webhook
```

**Request Body:**
```json
{
  "employer_account_id": "uuid",
  "url": "https://api.employer.com/webhooks/syllabusstack",
  "events": ["credential.issued", "credential.revoked", "skill.verified"]
}
```

**Response:**
```json
{
  "success": true,
  "webhook": {
    "id": "uuid",
    "url": "https://api.employer.com/webhooks/syllabusstack",
    "secret": "whsec_xxxxx",
    "events": ["credential.issued", "credential.revoked", "skill.verified"],
    "status": "active"
  }
}
```

### Webhook Events

#### credential.issued
Sent when a new certificate is issued.

```json
{
  "event": "credential.issued",
  "timestamp": "2026-02-02T12:00:00Z",
  "data": {
    "credential_id": "uuid",
    "student_id": "uuid",
    "course_id": "uuid",
    "certificate_type": "verified",
    "issued_at": "2026-02-02T12:00:00Z"
  }
}
```

#### credential.revoked
Sent when a certificate is revoked.

```json
{
  "event": "credential.revoked",
  "timestamp": "2026-02-02T12:00:00Z",
  "data": {
    "credential_id": "uuid",
    "reason": "academic_integrity_violation",
    "revoked_at": "2026-02-02T12:00:00Z"
  }
}
```

#### skill.verified
Sent when a skill is verified through assessment.

```json
{
  "event": "skill.verified",
  "timestamp": "2026-02-02T12:00:00Z",
  "data": {
    "student_id": "uuid",
    "skill_name": "Python Programming",
    "proficiency_level": "advanced",
    "verification_source": "assessment",
    "score": 92
  }
}
```

### Webhook Security

All webhook payloads are signed using HMAC-SHA256. Verify signatures before processing:

```python
import hmac
import hashlib

def verify_signature(payload, signature, secret):
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

The signature is sent in the `X-Signature-256` header.

## Identity Verification

### Initiate Identity Verification
Start identity verification for a student.

```http
POST /initiate-identity-verification
```

**Request Body:**
```json
{
  "return_url": "https://app.syllabusstack.com/verification/complete",
  "purpose": "certificate_issuance"
}
```

**Purposes:** `instructor_verification`, `certificate_issuance`, `employer_verification`

### Check Identity Verification Status
Get status of an identity verification request.

```http
GET /identity-verification-status
```

**Query Parameters:**
- `inquiry_id`: The Persona/Onfido inquiry ID

## Certificate Purchase

### Purchase Certificate
Initiate certificate purchase flow.

```http
POST /purchase-certificate
```

**Request Body:**
```json
{
  "course_id": "uuid",
  "certificate_type": "premium"
}
```

### Issue Certificate
Issue a certificate after verification.

```http
POST /issue-certificate
```

**Request Body:**
```json
{
  "enrollment_id": "uuid",
  "certificate_type": "verified",
  "mastery_score": 85,
  "skill_breakdown": {
    "Python": 90,
    "Data Analysis": 80,
    "SQL": 85
  }
}
```
