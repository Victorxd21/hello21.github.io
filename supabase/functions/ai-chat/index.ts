// Supabase Edge Function: ai-chat
// Secure general-purpose AI proxy with 10s server-side cooldown + safety system prompt.
// Secrets: OPENAI_API_KEY or XAI_API_KEY (optional AI_BASE_URL, AI_MODEL)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const COOLDOWN_MS = 10_000;
const MAX_BODY_BYTES = 32_000;
const MAX_MESSAGES = 20;
const MAX_CONTENT_LEN = 4000;

const SYSTEM_PROMPT = `You are a helpful, general-purpose AI assistant on a public game-hub website.
You can discuss a wide variety of appropriate topics: explanations, brainstorming, technology, writing assistance, education, culture, everyday questions, and more.
Do not restrict yourself to coding, programming, or gaming only.

Safety and privacy rules (always follow):
- Do not insult, harass, threaten, or target people.
- Do not generate personal attacks, defamatory allegations, or invasive claims about private individuals.
- Respect personal privacy. Do not help expose private information, credentials, addresses, or sensitive personal details.
- Avoid harmful or defamatory statements about schools, teachers, students, or other identifiable people. Discuss schools, policies, education, and school problems neutrally and constructively when asked.
- Do not invent accusations or present unverified allegations as facts.
- Refuse assistance that would meaningfully facilitate serious crimes, violence, exploitation, or other dangerous wrongdoing. When refusing, briefly explain and offer a safer alternative when appropriate.
- Be honest about uncertainty. Do not claim unverified information is true.
- Remain helpful with legitimate questions, including sensitive subjects that can be discussed safely.
- Ordinary questions, respectful criticism, help understanding policies, and discussions about school problems are allowed.
- Do not claim you can guarantee every answer is legally safe; reduce risk through careful responses.

Respond clearly and helpfully. Use markdown code fences when showing code. Keep responses reasonably concise unless the user asks for depth.`;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for") || "";
  const first = xf.split(",")[0]?.trim();
  if (first) return first.slice(0, 64);
  const real = req.headers.get("x-real-ip");
  if (real) return real.slice(0, 64);
  return "unknown";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) return json(413, { error: "Request too large" });

  let body: { messages?: unknown; client_id?: unknown };
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json(413, { error: "Request too large" });
    body = JSON.parse(text);
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const clientId =
    typeof body.client_id === "string" && body.client_id.length > 0
      ? body.client_id.slice(0, 80)
      : "anon";
  const ip = getClientIp(req);
  const rateKey = `${clientId}|${ip}`;

  const messagesIn = Array.isArray(body.messages) ? body.messages : null;
  if (!messagesIn || messagesIn.length === 0) return json(400, { error: "messages array is required" });
  if (messagesIn.length > MAX_MESSAGES) return json(400, { error: "Too many messages in history" });

  const cleaned: { role: string; content: string }[] = [];
  for (const m of messagesIn) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: string }).role;
    const content = (m as { content?: string }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const trimmed = content.trim().slice(0, MAX_CONTENT_LEN);
    if (!trimmed) continue;
    cleaned.push({ role, content: trimmed });
  }
  if (!cleaned.length || cleaned[cleaned.length - 1].role !== "user") {
    return json(400, { error: "Last message must be from the user" });
  }

  const sbUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!sbUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return json(500, { error: "Server configuration error" });
  }
  const sb = createClient(sbUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = Date.now();
  try {
    const { data: row, error: selErr } = await sb
      .from("ai_rate_limits")
      .select("last_request_at")
      .eq("rate_key", rateKey)
      .maybeSingle();

    if (selErr) {
      console.error("rate select error", selErr.message);
      return json(503, { error: "Rate limit service unavailable. Try again shortly." });
    }

    if (row?.last_request_at) {
      const last = new Date(row.last_request_at).getTime();
      const elapsed = now - last;
      if (elapsed < COOLDOWN_MS) {
        return json(429, {
          error: "Please wait before sending another message.",
          retry_after_ms: COOLDOWN_MS - elapsed,
          cooldown_ms: COOLDOWN_MS,
        });
      }
    }

    const { error: upErr } = await sb.from("ai_rate_limits").upsert(
      {
        rate_key: rateKey,
        last_request_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: "rate_key" }
    );
    if (upErr) {
      console.error("rate upsert error", upErr.message);
      return json(503, { error: "Rate limit service unavailable. Try again shortly." });
    }
  } catch (e) {
    console.error("rate limit exception", e);
    return json(503, { error: "Rate limit service unavailable. Try again shortly." });
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";
  const xaiKey = Deno.env.get("XAI_API_KEY") || "";
  const apiKey = openaiKey || xaiKey;
  if (!apiKey) {
    console.error("No OPENAI_API_KEY or XAI_API_KEY set");
    return json(503, { error: "AI provider is not configured. Please try again later." });
  }

  const baseUrl = (
    Deno.env.get("AI_BASE_URL") ||
    (xaiKey && !openaiKey ? "https://api.x.ai/v1" : "https://api.openai.com/v1")
  ).replace(/\/$/, "");
  const model =
    Deno.env.get("AI_MODEL") ||
    (xaiKey && !openaiKey ? "grok-2-latest" : "gpt-4o-mini");

  const apiMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...cleaned];

  let reply = "";
  try {
    const aiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    const aiText = await aiRes.text();
    let aiJson: { choices?: { message?: { content?: string } }[]; error?: { message?: string } } | null = null;
    try { aiJson = JSON.parse(aiText); } catch { aiJson = null; }

    if (!aiRes.ok) {
      console.error("AI provider error", aiRes.status, aiText.slice(0, 300));
      return json(502, {
        error: "The AI service returned an error. Please try again later.",
        cooldown_ms: COOLDOWN_MS,
      });
    }

    reply = aiJson?.choices?.[0]?.message?.content?.trim() || "";
    if (!reply) {
      return json(502, { error: "Empty response from the AI service.", cooldown_ms: COOLDOWN_MS });
    }
  } catch (e) {
    console.error("AI fetch failed", e);
    return json(502, {
      error: "Could not reach the AI service. Check your connection and try again.",
      cooldown_ms: COOLDOWN_MS,
    });
  }

  return json(200, { reply, cooldown_ms: COOLDOWN_MS });
});
