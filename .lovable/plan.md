

## Invite-Only Instructor Signup: Implementation Plan

### Current State (What Exists Today)

- **Open self-service signup** at `/become-instructor` — any logged-in user can apply; `.edu` emails auto-approve, others go to manual review
- **Landing page CTAs** (`/auth?role=instructor`) lead to public signup with instructor-flavored copy
- **`instructor_invite_codes` table** already exists (used for verification codes like the one in `use-invite-code` edge function), but is admin-created, not instructor-generated
- **`instructor_role_requests` table** tracks applications
- **`invite-users` edge function** exists but is admin-only org invitations, not instructor-to-instructor
- **Root user** `spprd@umkc.edu` is already active as admin/instructor

### Risk Areas (What Could Break)

1. **Landing page CTAs** — "Create Your Course" links to `/auth?role=instructor` which currently shows public signup. Blocking public instructor signup without updating these links would dead-end users.
2. **`/become-instructor` page** — Currently open to all. Must be gated by invite token or removed from public nav.
3. **`/teach` page** — Shows "Become an Instructor" CTA for non-instructors. Must change to "Request an Invite" or show invite-code entry.
4. **Existing pending requests** — Users who already submitted `instructor_role_requests` with status `pending` need a migration path.
5. **`.edu` auto-approve flow** — Currently bypasses review entirely. Must be disabled or redirected through invite flow.

### Implementation Plan

#### Phase 1: Database — `instructor_invitations` table

Create a new table to track the multi-level invite chain:

```text
instructor_invitations
├── id (uuid, PK)
├── inviter_id (uuid, FK profiles.user_id)  -- who sent the invite
├── invitee_email (text, NOT NULL)
├── token (text, UNIQUE, NOT NULL)          -- secure signup token
├── status (text: pending / accepted / expired)
├── depth_level (int, default 0)            -- root=0, their invites=1, etc.
├── max_invites_granted (int, default 1000) -- quota given to invitee
├── accepted_at (timestamptz)
├── accepted_by (uuid)                      -- user_id who signed up
├── created_at (timestamptz)
├── expires_at (timestamptz)                -- optional TTL
```

RLS policies:
- Instructors can SELECT their own sent invitations (`inviter_id = auth.uid()`)
- Service role handles INSERT/UPDATE during the invite flow

Add a `invited_by` column to `profiles` to track lineage.

#### Phase 2: Quota enforcement function

Create a `SECURITY DEFINER` function `get_invite_quota(p_user_id uuid)` that returns:
- `total_allowed` (1000 default)
- `total_used` (count of invitations sent)
- `remaining`

This prevents exceeding the 1,000-per-person cap.

#### Phase 3: Edge function — `send-instructor-invite`

- Authenticated endpoint, requires instructor role
- Validates quota, generates secure token, inserts into `instructor_invitations`
- Sends email via Resend with a signup link: `https://syllabusstack.com/auth?invite=TOKEN`
- Calculates `depth_level = inviter's depth + 1`

#### Phase 4: Auth page changes (`/auth`)

- Detect `?invite=TOKEN` query parameter
- If present: validate token against `instructor_invitations`, pre-fill email, show signup-only view
- On successful signup: mark invitation as `accepted`, auto-assign instructor role, set `invited_by` on profile
- If token is invalid/expired: show clear error, no fallback to open signup

**No change to student signup** — students continue signing up normally without an invite.

#### Phase 5: UI changes

| Location | Current | New |
|---|---|---|
| `/become-instructor` | Open form | Replaced with "Enter invite code or request one from a colleague" |
| `/teach` (non-instructor) | "Become an Instructor" button | "Have an invite? Enter it here" + invite code input |
| Landing page CTAs | Link to `/auth?role=instructor` | Link to `/auth?role=instructor` — shows "Instructor access is invite-only" with a field to enter invite token |
| HeroSection | "Create Your Course" | Keep text, but route to a gated page |
| HowItWorks | "Create a Course" href | Same treatment |

#### Phase 6: Instructor dashboard — "Invite Colleagues" section

- New component on `/teach` for verified instructors
- Shows: remaining invites (e.g., "987 of 1,000"), list of sent invites with status
- "Invite" form: enter email, sends via edge function
- Copy-shareable invite link

#### Phase 7: Seed root inviter

- Insert `spprd@umkc.edu` as depth_level=0 in profiles (`invited_by = NULL`)
- Ensure their quota is set to 1,000

### What Stays Unchanged

- Student signup flow (completely untouched)
- Student course enrollment via access codes
- Admin dashboard and admin invite functionality
- All existing instructor courses, enrollments, and data
- Organization invitations (separate system)

### Rollout Order

1. Database migration (table + function) — no UI impact
2. Edge function deployment — no UI impact
3. Auth page token detection — additive, existing flow still works
4. Gate `/become-instructor` and `/teach` CTAs — this is the "switch flip"
5. Add invite management UI to instructor dashboard

Steps 1-3 are safe to deploy without breaking anything. Step 4 is the breaking change and should ship together with step 5 so instructors can immediately start inviting.

