# AI Chat Edge Function (Google Gemini)

## Deploy

```bash
# From project root (with Supabase CLI linked to the project)
supabase functions deploy ai-chat --no-verify-jwt
```

`--no-verify-jwt` allows the public website (anon key) to call the function.
Rate limiting and body validation are enforced inside the function.

## Secrets

```bash
# Required — Google Gemini API key from https://aistudio.google.com/apikey
supabase secrets set GEMINI_API_KEY=your-gemini-api-key

# Optional model override (default: gemini-2.0-flash)
# Examples: gemini-2.0-flash, gemini-1.5-flash, gemini-2.5-flash, gemini-3.5-flash
supabase secrets set AI_MODEL=gemini-2.0-flash
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the platform.

## Database

Run the migration SQL in `supabase/migrations/20261028_ai_chat_and_secure_admin.sql` (creates `ai_rate_limits` and tightens RLS).

## CORS

The function allows browser origins. CORS is not authentication; the cooldown and request validation are the real controls.
