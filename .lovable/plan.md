

# Parity Plan: EduThree-Level Company Data & Project Generation

## Problem Summary

SyllabusStack's `company_profiles` table is missing **~20 columns** that EduThree captures from Apollo during discovery. This means:

1. **Missing organization fields**: logo, social links (LinkedIn/Twitter/Facebook), founded year, industry keywords
2. **Missing granular contact fields**: photo, headline, city/state/country, email status, employment history, phone numbers, twitter
3. **Missing location fields**: separate `city`, `zip`, `state`, `country` columns (only has `full_address`)
4. **Missing metadata**: `funding_events`, `data_enrichment_level`, `source`, `matching_skills`, `matching_dwas`
5. **Discovery stores less data**: The `discover-companies/index.ts` upsert only writes ~25 fields vs EduThree's ~45+

Additionally, EduThree captures ALL enrichment data **during discovery itself** (in `apollo-provider.ts`), so there's no need for a separate re-enrichment step.

---

## Plan

### Phase 1: Database Migration — Add Missing Columns

Add ~15 missing columns to `company_profiles`:

| Column | Type | Purpose |
|--------|------|---------|
| `city` | text | Separate city for structured display |
| `zip` | text | Postal code |
| `state` | text | State/province |
| `country` | text | Country |
| `organization_logo_url` | text | Company logo from Apollo |
| `organization_linkedin_url` | text | Company LinkedIn |
| `organization_twitter_url` | text | Company Twitter |
| `organization_facebook_url` | text | Company Facebook |
| `organization_founded_year` | integer | Year founded |
| `organization_employee_count` | text | Raw employee count/range |
| `organization_industry_keywords` | text[] | Industry tag list |
| `contact_headline` | text | Contact's headline |
| `contact_photo_url` | text | Contact's photo |
| `contact_city` | text | Contact's city |
| `contact_state` | text | Contact's state |
| `contact_country` | text | Contact's country |
| `contact_email_status` | text | Email verification status |
| `contact_employment_history` | jsonb | Employment history |
| `contact_phone_numbers` | jsonb | All phone numbers |
| `contact_twitter_url` | text | Contact's Twitter |
| `funding_events` | jsonb | Full funding history |
| `data_enrichment_level` | text | basic/apollo_verified/fully_enriched |
| `source` | text | Discovery source identifier |
| `matching_skills` | text[] | Skills that matched |

### Phase 2: Update Apollo Enrichment Service

Update `apollo-enrichment-service.ts` to capture ALL fields that EduThree's `apollo-provider.ts` captures during enrichment (lines 1937-2001):

- Organization: `logo_url`, `linkedin_url`, `twitter_url`, `facebook_url`, `founded_year`, `industry_tag_list`, `departmental_head_count`, `funding_events`
- Contact: `headline`, `photo_url`, `city`, `state`, `country`, `email_status`, `employment_history`, `phone_numbers`, `twitter_url`
- Metadata: `short_description`, `seo_description`, `industries`, `keywords`

### Phase 3: Update `discover-companies/index.ts` Upsert

Expand the `companyData` object to write ALL new fields during upsert — matching EduThree's 45+ field storage (lines 1327-1398):

- Separate location fields: `city`, `zip`, `state`, `country`
- Organization details: logo, social links, founded year, industry keywords
- Contact details: all granular contact fields from enrichment
- Market intelligence: funding events, data enrichment level
- Matching data: skills, DWAs

### Phase 4: Update Frontend Types & CompanyCard

1. Update `CompanyProfile` interface in `useCapstoneProjects.ts` to include all new fields
2. Enhance `CompanyCard.tsx` to display:
   - Company logo (if available)
   - Social links (LinkedIn, Twitter, Facebook icons)
   - Founded year
   - Contact photo + headline
   - Structured address (city, state, zip)
   - Data enrichment level badge
   - Industry keywords

### Phase 5: Update Project Generation

Ensure `generate-capstone-projects/index.ts` passes ALL enriched company data to the AI prompt (matching EduThree's `generation-service.ts`):
- Company `industries` and `keywords` for context
- `buying_intent_signals` for market intelligence
- `funding_events` for growth stage context
- `organization_employee_count` and `organization_revenue_range` for company sizing

---

## Technical Notes

- Database migration adds ~24 nullable columns — no impact on existing data
- The enrichment service changes extend existing interfaces, not breaking changes
- The `discover-companies` upsert expansion writes more data per company but doesn't change the pipeline flow
- Frontend changes are additive — cards show more data when available, gracefully degrade when not

