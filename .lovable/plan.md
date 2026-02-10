

## One-Time Evaluation Trigger for 233 Unevaluated Videos

### What It Does

Creates a temporary edge function (`trigger-pending-evaluations`) that:
1. Queries all `content_matches` with `status = 'pending'` and `ai_recommendation IS NULL` (233 videos across ~20 learning objectives)
2. Groups them by `learning_objective_id` (batches of 4-15 videos each)
3. Calls `evaluate-content-batch` for each group sequentially
4. Updates each match with AI scores, reasoning, and recommendation
5. Auto-approves highly recommended videos

You invoke it once manually, then delete it.

### Technical Details

#### New File: `supabase/functions/trigger-pending-evaluations/index.ts`

- Uses `SUPABASE_SERVICE_ROLE_KEY` to query and update directly (no user auth needed for this admin task)
- Fetches all pending/unevaluated content matches joined with their learning objective data (`text`, `bloom_level`, `core_concept`)
- Groups matches by `learning_objective_id`
- For each group, calls `evaluate-content-batch` internally via fetch, passing the service role key as the auth header
- Processes results: updates `ai_relevance_score`, `ai_pedagogy_score`, `ai_quality_score`, `match_score`, `ai_reasoning`, `ai_recommendation`, and status
- Adds a 2-second delay between groups to avoid rate limiting
- Returns a summary of how many videos were evaluated and how many auto-approved

#### Auth Consideration

The `evaluate-content-batch` function validates the auth token via `serviceClient.auth.getUser()`. The service role key won't return a "user" from `getUser()`. Two options:

- **Option A**: Have the trigger function call `evaluate-content-batch`'s internal logic directly (copy the AI call logic). This is simpler but duplicates code.
- **Option B**: Have the trigger function skip calling `evaluate-content-batch` and instead call the unified AI client directly to generate evaluations, then write results to the database.

I will use **Option B** -- the trigger function will import `generateText` from the shared unified AI client, reuse the same prompt template from `evaluate-content-batch`, and write scores directly to `content_matches`. This avoids auth issues entirely.

#### Config Update: `supabase/config.toml`

Add:
```toml
[functions.trigger-pending-evaluations]
verify_jwt = false
```

#### Cleanup

After running successfully, the function file can be deleted.

### Execution Flow

```text
POST /trigger-pending-evaluations
  --> Query 233 unevaluated content_matches
  --> Group into ~20 batches by learning_objective_id
  --> For each batch (15 videos max):
      --> Build evaluation prompt (same as evaluate-content-batch)
      --> Call Gemini Flash via unified-ai-client
      --> Parse scores, update content_matches
      --> 2s delay
  --> Return: { evaluated: 233, auto_approved: N, failed: M }
```
