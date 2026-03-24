

# Fix: Capture Real Office Addresses from Apollo API

## Problem
The addresses shown in the UI are incomplete (e.g., "Kansas City, Missouri, United States") because:
1. The **Apollo Organization Enrich API** returns `street_address`, `city`, `state`, `postal_code`, `country` — but SyllabusStack's `ApolloEnrichmentResponse` interface **does not capture any address fields**
2. The **Apollo Search API** returns `city`, `state`, `country` but SyllabusStack's `ApolloOrganization` interface is **missing `street_address` and `postal_code`**
3. The `full_address` is built from just `city, state, country` — no street, no zip
4. EduThree correctly builds addresses as `street_address, city, state, postal_code` from the enrichment response (lines 1921-1928 of `apollo-provider.ts`)

## Changes

### 1. Update `apollo-enrichment-service.ts` — Capture address fields from enrichment
- Add `street_address`, `city`, `state`, `postal_code`, `country`, `phone_number` to the `ApolloEnrichmentResponse.organization` interface
- Add these fields to `EnrichmentResult` interface
- Return them from `enrichOrganization()`

### 2. Update `apollo-precise-discovery.ts` — Capture address fields from search
- Add `street_address` and `postal_code` to the `ApolloOrganization` interface (already has `city`, `state`, `country`)
- Pass `street_address` and `postal_code` through in `transformOrganization()` to the `DiscoveredCompany` location object

### 3. Update `pipeline-types.ts` — Extend location type
- Add `streetAddress` and `postalCode` to the `DiscoveredCompany.location` type

### 4. Update `discover-companies/index.ts` — Build proper full_address
- When assembling `full_address`, prefer enrichment address fields (street_address, city, state, postal_code) from the enrichment result
- Fallback to search result location fields
- Build address as: `[street_address, city, state, postal_code].filter(Boolean).join(', ')` — matching EduThree's pattern

### Files Modified
| File | Change |
|------|--------|
| `_shared/capstone/apollo-enrichment-service.ts` | Add address fields to response/result types |
| `_shared/capstone/apollo-precise-discovery.ts` | Add `street_address`, `postal_code` to search interface |
| `_shared/capstone/pipeline-types.ts` | Extend location type with street/zip |
| `discover-companies/index.ts` | Build full_address from enrichment street+city+state+zip |

### Not Needed
- Google Geocoding triangulation is **not required** for address display — Apollo's enrichment endpoint already returns verified `street_address` directly. EduThree uses Google Geocoding only for **distance calculations** (already implemented in Phase A's Haversine logic via Nominatim). The address data itself comes directly from Apollo.

