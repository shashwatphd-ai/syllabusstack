

# Fix: Learning Objectives Column Name Mismatch

## Problem

Both `discover-companies` and `generate-capstone-projects` edge functions query `learning_objectives` for column `objective_text`, but the actual column in the database is called **`text`**. This causes the query to return rows with `null` values for `objective_text`, resulting in an empty array after `.map(lo => lo.objective_text)`, which triggers the "Course has no learning objectives" error.

## Fix (2 files)

### 1. `supabase/functions/discover-companies/index.ts`

- Line 64: Change `.select('id, objective_text, bloom_level')` → `.select('id, text, bloom_level')`
- Line 66: Change `lo.objective_text` → `lo.text`

### 2. `supabase/functions/generate-capstone-projects/index.ts`

- Line 61: Change `.select('id, objective_text, bloom_level')` → `.select('id, text, bloom_level')`
- Line 63: Change `lo.objective_text` → `lo.text`

## Root Cause

These edge functions were ported from EduThree1 where the learning objectives table used `objective_text` as the column name. SyllabusStack's table uses `text` instead. This was missed during the port.

