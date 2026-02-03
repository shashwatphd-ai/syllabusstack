
# Pricing Transparency Fix Plan

## Problem Summary

The landing page presents misleading pricing information:

### Current Misleading Claims

| Location | Current Text | Reality (in code) |
|----------|--------------|-------------------|
| Hero Section | "No credit card required" | $1 payment gates exist for course creation/enrollment |
| Hero Section | "Free to start" | True for browsing, but actions cost $1 |
| CTA Section | "Free to Get Started" | Partially true |
| CTA Section | "Free tier available" | Hides $1 per-action fees |
| Pricing Card | "Free - $0" | $1/course creation, $1/enrollment |
| Pricing Features | Shows only 3 limits | Missing $1 payment gate disclosure |

### Actual Economics (from code)

```text
FREE TIER:
+- Monthly subscription: $0
+- Course Creation: $1 per course
+- Course Enrollment: $1 per enrollment
+- AI Calls: 20/month
+- Max Courses: 3
+- Dream Jobs: 1

PRO TIER ($9.99/mo):
+- Course Creation: Unlimited (no fee)
+- Course Enrollment: Unlimited (no fee)
+- AI Calls: 200/month
+- Max Courses: Unlimited
+- Dream Jobs: 5

CERTIFICATES (all tiers):
+- Completion Badge: Free
+- Verified Certificate: $25
+- Assessed Certificate: $49
```

---

## Solution Strategy

**Two options** for solving this:

### Option A: Full Disclosure (Recommended)
Update the landing page to honestly show the $1 payment gates while positioning Pro as the better value.

### Option B: Remove Payment Gates
Remove the $1 fees entirely from the code to match the marketing claims.

I recommend **Option A** because:
1. The payment gates are already coded and working
2. It creates a natural upsell path to Pro
3. It filters for serious users on Free tier
4. Removing them requires backend changes across multiple edge functions

---

## Implementation Plan (Option A)

### Phase 1: Update PricingSection.tsx

**Changes to make:**

1. Change Free tier price display from `$0` to `$0*`
2. Add subtext explaining `*$1 per course or enrollment`
3. Add a new feature line: `$1 per course action`
4. Update Pro features to emphasize: `No per-action fees`

**Updated plans array:**

```text
FREE TIER:
- name: "Free"
- price: "$0*"
- tagline: "Try the basics."
- features:
  + "Up to 3 courses"
  + "1 dream job analysis"
  + "20 AI calls/month"
  + "$1 per course/enrollment" (NEW - with info tooltip)

PRO TIER:
- features:
  + "Unlimited courses"
  + "No per-action fees" (NEW - highlighted)
  + "Up to 5 dream jobs"
  + "200 AI calls/month"
  + "PDF export"
```

**Add footnote below pricing grid:**
```text
* Free tier includes $1 fee per course creation or enrollment
  to ensure quality. Pro subscribers have no per-action fees.
```

---

### Phase 2: Update HeroSection.tsx

**StudentHero changes:**

Replace:
```text
"No credit card required"
```

With:
```text
"First analysis free"
```

Keep but clarify:
```text
"Free to start" -> "Free to explore"
```

**InstructorHero changes:**

Replace:
```text
"Free to start"
```

With:
```text
"Create for $1 or upgrade to Pro"
```

Or simpler:
```text
"Start for just $1"
```

---

### Phase 3: Update CTASection.tsx

**Changes:**

1. Badge: `"Free to Get Started"` -> `"Try Free Today"`

2. Trust indicators - replace:
```text
- "No credit card required" -> "No monthly commitment"
- "Free tier available" -> "Pay per action or subscribe"
```

Or keep it simple:
```text
- "Start exploring free"
- "Pro unlocks everything"
- "Set up in minutes"
```

---

### Phase 4: Add Feature Comparison to Landing Page

Create a new section or expand PricingSection to include a clear comparison table showing:

```text
+-------------------------+----------+----------+
| Feature                 | Free     | Pro      |
+-------------------------+----------+----------+
| Syllabus Analysis       | Free     | Free     |
| Gap Analysis            | Free     | Advanced |
| Course Creation         | $1 each  | Included |
| Course Enrollment       | $1 each  | Included |
| AI Calls                | 20/mo    | 200/mo   |
| PDF Export              | -        | Yes      |
| Verified Certificate    | $25      | $25      |
| Assessed Certificate    | $49      | $49      |
+-------------------------+----------+----------+
```

---

### Phase 5: Update TIER_INFO in useSubscription.ts

Add disclosure to the features array:

```typescript
free: {
  features: [
    'Up to 3 course syllabi',
    '1 dream job profile',
    '20 AI analyses/month',
    'Basic gap analysis',
    '$1 per course action', // NEW
  ],
},
pro: {
  features: [
    'Unlimited course syllabi',
    'No per-action fees',  // NEW - moved to top
    'Up to 5 dream job profiles',
    '200 AI analyses/month',
    // ...rest
  ],
},
```

---

### Phase 6: Update PricingTable.tsx (Billing Page)

Add a row to the FeatureComparison table:

```typescript
{ name: 'Course/Enrollment Fee', free: '$1 each', pro: 'Included', university: 'Included' },
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/landing/PricingSection.tsx` | Update Free tier display, add footnote, highlight Pro value |
| `src/components/landing/HeroSection.tsx` | Update trust indicators for both Student and Instructor hero |
| `src/components/landing/CTASection.tsx` | Update badge and trust indicators |
| `src/hooks/useSubscription.ts` | Update TIER_INFO features array |
| `src/components/billing/PricingTable.tsx` | Add row for per-action fees |

---

## Copy Recommendations

### Option 1: Honest + Value-Focused
- **Free**: "$0 + $1/action"
- **Tagline**: "Pay as you go"
- **Trust**: "Start exploring free"

### Option 2: Pro-Forward
- **Free**: "$0*" (with asterisk)
- **Tagline**: "Try the basics"
- **Trust**: "Pro unlocks unlimited access"

### Option 3: Minimal Change
- Keep "$0" but add small footnote
- Add one line to features: "Per-action fees apply"
- Update one trust indicator

---

## Technical Implementation Details

### PricingSection.tsx Changes

1. Add price footnote indicator:
```tsx
<span className="text-2xl font-bold">
  {plan.price}
  {plan.name === "Free" && <sup className="text-xs">*</sup>}
</span>
```

2. Add footnote component below grid:
```tsx
<p className="text-center text-sm text-muted-foreground mt-6">
  * Free tier includes $1 fee per course creation or enrollment.
  <Link to="/pricing" className="text-coral-500 ml-1">
    See full pricing details
  </Link>
</p>
```

3. Update features array to add "$1 per course/enrollment" line

### HeroSection.tsx Changes

Update trust indicators in StudentHero and InstructorHero:
```tsx
<span className="flex items-center gap-2">
  <CheckCircle className="w-4 h-4 text-coral-400" />
  First analysis free
</span>
```

### CTASection.tsx Changes

Update badge and trust indicators to be accurate while still appealing.

---

## Testing Checklist

After implementation:
- [ ] Verify PricingSection shows asterisk on Free tier
- [ ] Verify footnote appears and links correctly
- [ ] Verify HeroSection trust indicators are accurate
- [ ] Verify CTASection trust indicators are accurate
- [ ] Verify PricingTable includes fee comparison row
- [ ] Mobile responsive check for new text
- [ ] Dark mode check for new text styling

---

## Impact Assessment

**Before:**
- Potentially misleading - users may feel deceived when hitting $1 payment gate

**After:**
- Clear expectations - users know about $1 fees upfront
- Better Pro conversion - $1 fees make $9.99/mo look like great value
- Trust building - honesty improves brand perception

