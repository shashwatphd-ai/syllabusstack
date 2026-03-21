# EduThree1 Capstone Pipeline — SyllabusStack Implementation Status

## Batch Status

| Batch | Description | Status |
|---|---|---|
| Batch 1 | SOC Mapping + Location + Industry Filtering | ✅ Done |
| Batch 2 | Skill Extraction + Apollo Discovery Rewrite | ✅ Done |
| Batch 3 | Company Validation + Ranking | ✅ Done |
| Batch 4 | Enhanced Generation + Pricing + Alignment | ✅ Done |
| Batch 5 | Pipeline Orchestrator + Tech Mapping + Competency Extraction | ✅ Done |
| Batch 6 | Frontend Integration | 🔜 Next |

---

## Files Implemented

| File | Lines | Status |
|---|---|---|
| `_shared/capstone/course-soc-mapping.ts` | 486 | ✅ ~95% parity |
| `_shared/capstone/location-utils.ts` | ~100 | ✅ ~90% parity |
| `_shared/capstone/context-aware-industry-filter.ts` | 219 | ✅ ~95% parity |
| `_shared/capstone/pipeline-types.ts` | 133 | ✅ Full types |
| `_shared/capstone/skill-extraction.ts` | 232 | ✅ AI + SOC + regex fallback |
| `_shared/capstone/apollo-precise-discovery.ts` | 304 | ✅ 2-strategy (tech UIDs unreliable in Apollo) |
| `_shared/capstone/apollo-technology-mapping.ts` | ~200 | ✅ SOC→Tech UID mapping + scoring |
| `_shared/capstone/company-validation-service.ts` | ~250 | ✅ AI fit validation |
| `_shared/capstone/company-ranking-service.ts` | 352 | ✅ 5-factor weighted scoring |
| `_shared/capstone/generation-service.ts` | ~500 | ✅ 250-line domain-specific prompt |
| `_shared/capstone/alignment-service.ts` | ~350 | ✅ LO-to-task mapping + synonym expansion |
| `_shared/capstone/pricing-service.ts` | ~500 | ✅ Apollo-enriched pricing |
| `_shared/capstone/discovery-pipeline.ts` | ~260 | ✅ 5-phase orchestrator |
| `discover-companies/index.ts` | 322 | ✅ Full pipeline with validation + ranking |
| `generate-capstone-projects/index.ts` | ~500 | ✅ Full generation with 6-form + milestones |
| `extract-capstone-competencies/index.ts` | ~240 | ✅ Tool calling + job-matcher chain |

**Total backend code**: ~4,500+ lines
**Existing SyllabusStack impact**: Zero — all within `_shared/capstone/` + capstone edge functions

---

## Remaining: Batch 6 (Frontend Integration)

### Files to modify:
- `src/hooks/useCapstoneProjects.ts` — Add pipeline phase output hooks
- `src/components/capstone/CapstoneProjectsTab.tsx` — Show discovery progress & ranking scores

### External dependencies NOT configured (using fallbacks):
- **Lightcast**: Using AI-powered extraction via Gemini (no API key needed)
- **O*NET**: Using curated SOC mapping table (no API key needed)
- **Adzuna**: Not implemented (Apollo is primary, job-matcher is separate)
- **Apollo Technology UIDs**: Mapped but disabled in search (Apollo API unreliable for this filter — same issue EduThree1 had)
