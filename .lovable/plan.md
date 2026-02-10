

## Make Course Enrollment Free (with a Toggle to Re-enable Payment)

### Current System

The enrollment payment logic lives in **two places**:

1. **Backend** (`supabase/functions/enroll-in-course/index.ts`): Lines 92-207 check if the user is Pro. If yes, enroll for free. If not, create a Stripe checkout session for $1.
2. **Frontend** (`src/components/student/EnrollmentDialog.tsx`): Shows "$1.00" pricing, "Pay $1 & Enroll" button text, and handles the Stripe redirect flow for non-Pro users.

There is **no feature flag system** currently — the $1 fee is hardcoded.

### What We Will Build

A simple boolean toggle (`ENROLLMENT_FREE`) that controls whether enrollment requires payment, making it easy to switch back to paid later.

### Changes

#### 1. Backend: Add toggle to the edge function

**File:** `supabase/functions/enroll-in-course/index.ts`

Add a constant at the top of the file:

```typescript
// Toggle: set to true for free enrollment, false to require $1 payment
const ENROLLMENT_FREE = true;
```

Then modify the logic so that when `ENROLLMENT_FREE` is `true`, **all users** (not just Pro) get enrolled immediately for free — using the same insert logic that already exists for Pro users. The Stripe checkout code stays in place but is simply skipped.

When you want to re-enable payment, change `ENROLLMENT_FREE` to `false` and redeploy.

#### 2. Frontend: Respect the backend response (no hardcoded prices)

**File:** `src/components/student/EnrollmentDialog.tsx`

- Remove the `isPro` check and the "$1.00" / "Pay $1 & Enroll" UI
- Replace with a simple "Enroll Now" button for all users
- The pricing info section (showing "$1.00" or "Free with Pro") will be removed since enrollment is free
- The payment redirect flow stays in code but won't trigger because the backend will always return `requires_payment: false`

#### 3. Landing page pricing table update

**File:** `src/components/billing/PricingTable.tsx`

- Update the feature comparison row from `'$1 each'` to `'Free'` for the free tier

### How to Switch Back to Paid

When you're ready to charge for enrollment again:

1. Open `supabase/functions/enroll-in-course/index.ts`
2. Change `const ENROLLMENT_FREE = true;` to `const ENROLLMENT_FREE = false;`
3. Redeploy the function
4. Update the frontend `EnrollmentDialog` to restore pricing UI
5. Update `PricingTable` feature row back to `'$1 each'`

### Technical Details

The toggle approach was chosen over a database-based feature flag because:
- It requires zero schema changes
- It's a single constant change to flip
- The edge function redeploys automatically
- No additional database queries on every enrollment request

