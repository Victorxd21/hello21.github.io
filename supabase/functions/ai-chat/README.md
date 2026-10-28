# AI Chat Edge Function

## Deploy

```bash
# From project root (with Supabase CLI linked to the project)
supabase functions deploy ai-chat --no-verify-jwt
```

`--no-verify-jwt` allows the public website (anon key) to call the function.
Rate limiting and body validation are enforced inside the function.

## Secrets

```bash
# Required — pick one provider
supabase secrets set OPENAI_API_KEY=sk-...
# OR for xAI / Grok:
supabase secrets set XAI_API_KEY=xai-...

# Optional overrides
supabase secrets set AI_BASE_URL=https://api.openai.com/v1
supabase secrets set AI_MODEL=gpt-4o-mini
# For xAI example:
# supabase secrets set AI_BASE_URL=https://api.x.ai/v1
# supabase secrets set AI_MODEL=grok-2-latest
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the platform.

## Database

Run the migration SQL in `supabase/migrations/20261028_ai_chat_and_secure_admin.sql` (creates `ai_rate_limits` and tightens RLS).

## CORS

The function allows browser origins. CORS is not authentication; the cooldown and request validation are the real controls.
