import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ALLOWED_ORIGINS = [
  "https://epsteinfoundation.org",
  "https://www.epsteinfoundation.org",
  "http://localhost:4173",
  "http://localhost:3000",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:3000"
];

export function getCorsHeaders(req?: Request) {
  const origin = req ? req.headers.get("origin") || "" : "";
  const isAllowed = Boolean(
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(origin) ||
    /^https:\/\/[a-zA-Z0-9_-]+\.netlify\.app$/.test(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  );

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://epsteinfoundation.org",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin"
  };
}

export const cors = getCorsHeaders();

export const reply = (data: unknown, status = 200, req?: Request) => {
  const headers = getCorsHeaders(req);
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
};

export const preflight = (r: Request) =>
  r.method === "OPTIONS"
    ? new Response("ok", { headers: getCorsHeaders(r) })
    : null;

export const db = () => {
  const secrets = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const key = secrets.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Server database key is unavailable");
  return createClient(Deno.env.get("SUPABASE_URL")!, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
};

export const clean = (v: unknown, n = 250) =>
  typeof v === "string" ? v.trim().slice(0, n) : "";

export async function limited(client: any, req: Request) {
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(ip + "|direct-support")
  );
  const hash = Array.from(new Uint8Array(digest))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const since = new Date(Date.now() - 600000).toISOString();
  const { count, error } = await client
    .from("verification_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", hash)
    .gte("created_at", since);
  if (error) throw error;
  if ((count || 0) >= 8) return false;
  const { error: insertError } = await client
    .from("verification_rate_limits")
    .insert({ ip_hash: hash });
  if (insertError) throw insertError;
  return true;
}
