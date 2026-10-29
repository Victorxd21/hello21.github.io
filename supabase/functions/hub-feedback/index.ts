import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const MAX_BODY_BYTES = 5_000;
const COOLDOWN_SECONDS = 30;

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
  const forwarded = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0].trim().slice(0, 64) || "unknown";
}

async function hashIp(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) return json(413, { error: "Request too large" });

  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json(413, { error: "Request too large" });
    body = JSON.parse(text);
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  if (typeof body.website === "string" && body.website.trim()) return json(202, { ok: true });
  const kind = body.kind === "request" ? "request" : body.kind === "problem" ? "problem" : "";
  const gameName = typeof body.game_name === "string" ? body.game_name.trim().slice(0, 120) : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!kind) return json(400, { error: "Choose a report or request type." });
  if (message.length < 8 || message.length > 2000) {
    return json(400, { error: "Details must be between 8 and 2000 characters." });
  }

  const sbUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!sbUrl || !serviceKey) return json(500, { error: "Server configuration error" });
  const sb = createClient(sbUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const rateKey = await hashIp(getClientIp(req), serviceKey);
    const { data: allowed, error: rateError } = await sb.rpc("consume_hub_feedback_rate_limit", {
      p_rate_key: rateKey,
      p_cooldown_seconds: COOLDOWN_SECONDS,
    });
    if (rateError) {
      console.error("feedback rate limit error", rateError.message);
      return json(503, { error: "Feedback is temporarily unavailable. Try again shortly." });
    }
    if (!allowed) return json(429, { error: "Please wait before sending more feedback." });

    const { error: insertError } = await sb.from("hub_feedback").insert({
      kind,
      game_name: gameName,
      message,
    });
    if (insertError) {
      console.error("feedback insert error", insertError.message);
      return json(503, { error: "Could not save your feedback. Please try again later." });
    }
    return json(201, { ok: true });
  } catch (error) {
    console.error("feedback submission error", error);
    return json(503, { error: "Feedback is temporarily unavailable. Try again shortly." });
  }
});