import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_DIR = path.resolve(import.meta.dirname, "..");

test("R1: Admin Google OAuth Elements in index.html", async () => {
  const htmlPath = path.join(BASE_DIR, "public", "abcdauth", "index.html");
  const html = await fs.readFile(htmlPath, "utf-8");

  // Google Sign-In button exists
  assert.match(html, /id="google-login-btn"/, "Google login button (#google-login-btn) must be present in admin HTML");

  // Official Google SVG icon exists with the 4 brand colors
  assert.match(html, /#4285F4/, "Google SVG must include blue path (#4285F4)");
  assert.match(html, /#34A853/, "Google SVG must include green path (#34A853)");
  assert.match(html, /#FBBC05/, "Google SVG must include yellow path (#FBBC05)");
  assert.match(html, /#EA4335/, "Google SVG must include red path (#EA4335)");

  // Auth divider exists
  assert.match(html, /class="auth-divider"/, "Auth divider must be present");
  assert.match(html, /or username & password/i, "Auth divider label must explain credentials option");

  // Password visibility toggle and confirm password exist
  assert.match(html, /id="confirm-password"/, "Confirm password field must exist");
  assert.match(html, /class="pwd-toggle"/, "Password visibility toggles must exist");
});

test("R1: Supabase Client Authentication Configuration", async () => {
  const initPath = path.join(BASE_DIR, "public", "js", "supabase-init.js");
  const content = await fs.readFile(initPath, "utf-8");

  assert.match(content, /detectSessionInUrl:\s*true/, "detectSessionInUrl must be true for OAuth redirect parsing");
  assert.match(content, /persistSession:\s*true/, "persistSession must be true to retain user session");
  assert.match(content, /autoRefreshToken:\s*true/, "autoRefreshToken must be true");
  assert.match(content, /flowType:\s*["']pkce["']/, "flowType must be pkce for secure client-side OAuth");
});

test("R1: Admin Client Logic Wires Google OAuth & Callback Handling", async () => {
  const adminJsPath = path.join(BASE_DIR, "public", "abcdauth", "admin.js");
  const content = await fs.readFile(adminJsPath, "utf-8");

  // Imports supabase
  assert.match(content, /import\s*\{[^}]*supabase[^}]*\}\s*from\s*["']\.\.\/js\/supabase-init\.js["']/, "admin.js must import supabase client");

  // Initiates Google OAuth with redirectTo /abcdauth
  assert.match(content, /signInWithOAuth\(\s*\{[^}]*provider:\s*["']google["']/s, "Must call supabase.auth.signInWithOAuth with provider google");
  assert.match(content, /redirectTo:\s*`?\$\{window\.location\.origin\}\/abcdauth`?/, "redirectTo must point to /abcdauth");

  // Handles query param errors (?error=...)
  assert.match(content, /params\.get\(["']error["']\)/, "initAuth must check for query parameter error");

  // Inspects active session and exchanges with admin-api?action=google-login
  assert.match(content, /supabase\.auth\.getSession\(\)/, "initAuth must retrieve active Supabase session");
  assert.match(content, /api\(["']google-login["'],\s*\{[^}]*body:\s*\{[^}]*accessToken:\s*session\.access_token/s, "Must exchange OAuth access token with google-login action");

  // Logout invokes supabase.auth.signOut()
  assert.match(content, /supabase\.auth\.signOut\(\)/, "Logout handler must call supabase.auth.signOut");
});

test("R1: Backend admin-api Google Login Handler & Authorization Whitelist", async () => {
  const indexPath = path.join(BASE_DIR, "supabase", "functions", "admin-api", "index.ts");
  const content = await fs.readFile(indexPath, "utf-8");

  // Action google-login exists
  assert.match(content, /action===["']google-login["']|action\s*===\s*["']google-login["']/, "admin-api must have action === 'google-login'");

  // Validates token using client.auth.getUser()
  assert.match(content, /client\.auth\.getUser\(\s*accessToken\s*\)/, "Must verify access token with client.auth.getUser");

  // Whitelist checks
  assert.match(content, /admin_users/, "Must check admin_users table");
  assert.match(content, /ADMIN_EMAILS/, "Must support ADMIN_EMAILS environment variable");
  assert.match(content, /@epsteinfoundation\.org/, "Must support foundation domain authorization");

  // Returns 403 on unauthorized user
  assert.match(content, /403/, "Must return 403 HTTP status on unauthorized account");

  // Issues HMAC admin token on success
  assert.match(content, /await\s+token\(/, "Must issue signed admin session token on success");
});
