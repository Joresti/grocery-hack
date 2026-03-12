# Prompt Test

Run a Claude prompt template with sample input to verify the output format — no database or server required.

## Input

$ARGUMENTS — The pipeline prompt to test: `scraper` or `planner`

## Instructions

1. **Read the relevant pipeline spec:**
   - If `scraper`: read `docs/pipelines/scraper-pipeline.md`
   - If `planner`: read `docs/pipelines/planner-pipeline.md`

2. **Read supporting files:**
   - `docs/architecture/env-spec.md` — for model names and API key variable
   - `packages/shared/types.ts` — for expected output types

3. **Construct sample input** based on the pipeline spec:

   **For scraper:**
   - Use a sample flyer page screenshot description (text, not actual image)
   - Include sample visible text from a flyer page
   - Use the exact system prompt and user prompt templates from the spec

   **For planner:**
   - Use 3-4 sample deals from `docs/data/seed-data.md`
   - Use 2-3 sample meals from `docs/data/seed-data.md`
   - Use a sample user profile (budget, dietary restrictions, household size)
   - Use the exact system prompt and user prompt templates from the spec

4. **Make the Claude API call** using `@anthropic-ai/sdk`:

   ```typescript
   import Anthropic from '@anthropic-ai/sdk';

   const client = new Anthropic();  // uses ANTHROPIC_API_KEY env var

   const response = await client.messages.create({
     model: process.env.CLAUDE_SCRAPER_MODEL ?? 'claude-haiku-4-5-20251001',  // or planner model
     max_tokens: 4096,
     system: systemPrompt,
     messages: [{ role: 'user', content: userPrompt }],
   });
   ```

5. **Validate the response:**
   - Parse the JSON output from Claude's response
   - Check that it matches the expected schema from the pipeline spec
   - Report any missing fields, wrong types, or unexpected values
   - Show token usage (input tokens, output tokens) and estimated cost

6. **Output the results:**
   ```
   ## Prompt Test: {scraper|planner}

   ### Input
   - Model: {model name}
   - System prompt: {first 100 chars}...
   - User prompt: {first 200 chars}...

   ### Response
   {formatted JSON output}

   ### Validation
   - Schema match: {pass/fail}
   - Missing fields: {list or "none"}
   - Unexpected fields: {list or "none"}

   ### Usage
   - Input tokens: {N}
   - Output tokens: {N}
   - Estimated cost: ${X.XXXX}
   ```

7. **Do not write any files.** This is a read-and-execute-only command. The only side effect is the Claude API call.

8. **Check the spend limit first.** Before calling Claude, warn the user about the estimated cost and ask for confirmation if `CLAUDE_MONTHLY_BUDGET_USD` would be exceeded.
