# Email Configuration Guide

## Overview

SyllabusStack uses [Resend](https://resend.com) for transactional emails. This guide covers setting up email functionality for:
- Weekly digest emails
- Progress updates
- New recommendation notifications

## Prerequisites

1. A Resend account (free tier allows 100 emails/day, 3,000/month)
2. Access to your Supabase project dashboard

## Step 1: Get Your Resend API Key

1. Sign up at [resend.com](https://resend.com)
2. Navigate to **API Keys** in the Resend dashboard
3. Create a new API key with "Sending access" permissions
4. Copy the key (starts with `re_`)

## Step 2: Configure Supabase Secrets

### Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Settings > Edge Functions**
3. Click **Manage Secrets**
4. Add a new secret:
   - **Name**: `RESEND_API_KEY`
   - **Value**: Your Resend API key (e.g., `re_123abc...`)
5. Click **Save**

### Using Supabase CLI

```bash
# Set the secret using CLI
supabase secrets set RESEND_API_KEY=re_your_api_key_here
```

## Step 3: Configure Email Domain (Production)

For production, you should verify your own domain with Resend:

1. In Resend dashboard, go to **Domains**
2. Add your domain (e.g., `syllabusstack.com`)
3. Add the required DNS records
4. Wait for verification (usually a few minutes)
5. Update the `from` address in `send-digest-email/index.ts`:

```typescript
// Change from:
from: "SyllabusStack <noreply@resend.dev>"
// To your verified domain:
from: "SyllabusStack <notifications@syllabusstack.com>"
```

## Step 4: Enable Scheduled Emails

The weekly digest is scheduled to run every Monday at 9:00 AM UTC via pg_cron.

### Verify the Schedule

1. Go to Supabase SQL Editor
2. Run:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'send-weekly-digest';
   ```

### Manually Trigger (For Testing)

```bash
# Test the digest email function
curl -X POST 'https://your-project.supabase.co/functions/v1/send-digest-email' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

## Email Types

### 1. Weekly Digest
- **Trigger**: Automated, every Monday 9:00 AM UTC
- **Recipients**: Users who:
  - Have `weekly_digest: true` in email preferences
  - Haven't been active in the past 7 days
- **Content**: Progress summary, pending recommendations

### 2. Progress Updates (Future)
- **Trigger**: When user completes a milestone
- **Implementation**: Add to `complete-assessment` function

### 3. New Recommendations (Future)
- **Trigger**: After `generate-recommendations` runs
- **Implementation**: Add to `generate-recommendations` function

## Troubleshooting

### "RESEND_API_KEY is not configured"
- Verify the secret is set in Supabase dashboard
- Ensure the secret name is exactly `RESEND_API_KEY`

### Emails not being sent
1. Check Resend dashboard for delivery status
2. Verify user email preferences in database
3. Check edge function logs for errors

### Domain verification issues
- DNS propagation can take up to 48 hours
- Use [MXToolbox](https://mxtoolbox.com) to verify DNS records

## Email Preferences Database Schema

```sql
-- In profiles table
email_preferences JSONB DEFAULT '{"weekly_digest": true, "progress_updates": true, "new_recommendations": true}'
```

## API Reference

### send-digest-email

**Endpoint**: `POST /functions/v1/send-digest-email`

**Authentication**: Service role key (internal use only)

**Response**:
```json
{
  "success": true,
  "emailsSent": 5,
  "errors": 0,
  "details": {
    "sent": ["user1@example.com", ...],
    "failed": []
  }
}
```

## Cost Considerations

| Tier | Monthly Limit | Cost |
|------|--------------|------|
| Free | 3,000 emails | $0 |
| Pro | 50,000 emails | $20/mo |
| Scale | 100,000+ | Custom |

For most early-stage products, the free tier is sufficient.
