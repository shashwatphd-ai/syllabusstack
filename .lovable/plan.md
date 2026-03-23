

# Plan: Generate Architecture Plan & PRD Documents

## Summary

Two professional DOCX documents will be generated from the comprehensive codebase analysis already completed. The script is written and ready at `/tmp/gen_docs.js`.

## Approach

**Single step**: Execute the existing generation script that creates both documents using the `docx` npm library. The script contains all content derived from the actual codebase files reviewed (17 service files, 7 frontend components, 3 edge functions, database schema).

### Document 1: Architecture Plan (~12 pages)
- System architecture overview with pipeline stage diagram
- Data flow diagram (8-phase discovery, 8-step generation)
- External service dependency matrix
- Backend service file inventory (17 files with line counts and purposes)
- Database schema detail (company_profiles 40+ columns, capstone_projects, project_forms)
- Discovery pipeline phases 1-8 with inputs/outputs/files
- Generation pipeline phases 1-6 with scoring formulas
- Frontend component inventory and report view architecture
- Known gaps vs EduThree1 with priority and resolution
- Deployment and operations notes

### Document 2: PRD (~10 pages)
- Product overview, target users, success metrics
- 4 user stories with detailed acceptance criteria
- Functional requirements matrix (FR-1 through FR-35) with priority and status tracking (Done/Pending/Verify)
- Data model comparison (EduThree1 vs SyllabusStack)
- SyllabusStack advantages (Bloom levels, search keywords)
- Reference output: EduThree1's exact 25-page report structure mapped page-by-page
- Open questions for EduThree1 codebase (5 specific questions needing answers)
- Implementation roadmap (4 phases: Backend fixes, Frontend report, Score computation, Polish)

### Technical Detail
- Script: `/tmp/gen_docs.js` (already written, ~600 lines)
- Output: `/mnt/documents/SyllabusStack_Capstone_Architecture_Plan.docx` and `/mnt/documents/SyllabusStack_Capstone_PRD.docx`
- Uses `docx` npm library with professional styling (Arial, navy headers, bordered tables, page numbers)

