import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_DIR = path.resolve(import.meta.dirname, "..");

test("R3/R4: vercel.json Security Headers and CSP Compliance", async () => {
  const vercelPath = path.join(BASE_DIR, "vercel.json");
  const vercelRaw = await fs.readFile(vercelPath, "utf-8");
  const vercel = JSON.parse(vercelRaw);

  assert.equal(vercel.outputDirectory, "public", "vercel.json must specify outputDirectory: 'public'");
  assert.equal(vercel.cleanUrls, true, "cleanUrls must be enabled");

  const globalHeaders = vercel.headers?.find((h) => h.source === "/(.*)")?.headers || [];
  const getHeader = (key) => globalHeaders.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

  assert.equal(getHeader("X-Content-Type-Options"), "nosniff");
  assert.equal(getHeader("X-Frame-Options"), "DENY");
  assert.equal(getHeader("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.match(getHeader("Strict-Transport-Security"), /max-age=\d+/);

  const csp = getHeader("Content-Security-Policy");
  assert.ok(csp, "Content-Security-Policy must be defined");
  assert.match(csp, /script-src[^;]*https:\/\/accounts\.google\.com/, "CSP script-src must allow Google Accounts for OAuth");
  assert.match(csp, /connect-src[^;]*https:\/\/accounts\.google\.com/, "CSP connect-src must allow Google Accounts");
  assert.match(csp, /connect-src[^;]*https:\/\/elndnwiujkghclblnuyl\.supabase\.co/, "CSP connect-src must allow Supabase backend");
  assert.match(csp, /frame-src[^;]*https:\/\/accounts\.google\.com/, "CSP frame-src must allow Google Accounts");
  assert.match(csp, /form-action[^;]*https:\/\/accounts\.google\.com/, "CSP form-action must allow Google Accounts");
  assert.match(csp, /form-action[^;]*https:\/\/elndnwiujkghclblnuyl\.supabase\.co/, "CSP form-action must allow Supabase Auth");
  assert.match(csp, /frame-ancestors 'none'/, "CSP must prevent clickjacking via frame-ancestors 'none'");
});

test("R3/R4: public/_headers Security Headers and CSP Synchronization", async () => {
  const headersPath = path.join(BASE_DIR, "public", "_headers");
  const content = await fs.readFile(headersPath, "utf-8");

  assert.match(content, /Content-Security-Policy:/, "public/_headers must contain Content-Security-Policy");
  assert.match(content, /https:\/\/accounts\.google\.com/, "public/_headers CSP must permit Google OAuth");
  assert.match(content, /https:\/\/elndnwiujkghclblnuyl\.supabase\.co/, "public/_headers CSP must permit Supabase");
  assert.match(content, /X-Content-Type-Options:\s*nosniff/, "nosniff must be present");
  assert.match(content, /X-Frame-Options:\s*DENY/, "DENY must be present");
});

test("R3/R4: Server Edge Function CORS Policy Does Not Allow Wildcard", async () => {
  const sharedPath = path.join(BASE_DIR, "supabase", "functions", "admin-api", "_shared.ts");
  const content = await fs.readFile(sharedPath, "utf-8");

  // Wildcard * must NOT be used for Access-Control-Allow-Origin
  assert.doesNotMatch(
    content,
    /"Access-Control-Allow-Origin":\s*"\*"/,
    "admin-api must not use wildcard '*' for Access-Control-Allow-Origin"
  );

  // Must have origin validation
  assert.match(content, /ALLOWED_ORIGINS/, "Must define ALLOWED_ORIGINS whitelist");
  assert.match(content, /getCorsHeaders/, "Must implement getCorsHeaders dynamic check");
  assert.match(content, /Vary:\s*"Origin"|"Vary":\s*"Origin"/, "Must send Vary: Origin header");
});

test("R3/R4: Documentation Sanitization Check", async () => {
  const readmePath = path.join(BASE_DIR, "README.md");
  const content = await fs.readFile(readmePath, "utf-8");

  assert.doesNotMatch(content, /Password@1234@/, "README.md must not contain default plaintext passwords");
  assert.doesNotMatch(content, /Initial administrator/, "README.md must not expose default admin credentials");
});
