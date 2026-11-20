import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_DIR = path.resolve(import.meta.dirname, "..");

test("R3/R4: Route Protection Rejects Unauthenticated Requests with HTTP 401", async () => {
  const initPath = path.join(BASE_DIR, "public", "js", "supabase-init.js");
  const initContent = await fs.readFile(initPath, "utf-8");
  const urlMatch = initContent.match(/SUPABASE_URL\s*=\s*["']([^"']+)["']/);
  const keyMatch = initContent.match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*["']([^"']+)["']/);

  assert.ok(urlMatch && keyMatch);
  const supabaseUrl = urlMatch[1];
  const apiKey = keyMatch[1];

  // 1. Unauthenticated request to contributions returns 401
  const resContrib = await fetch(`${supabaseUrl}/functions/v1/admin-api?action=contributions`, {
    headers: { apikey: apiKey }
  });
  assert.equal(resContrib.status, 401, "Unauthenticated request to action=contributions must return HTTP 401");
  const jsonContrib = await resContrib.json();
  assert.equal(jsonContrib.success, false, "Must report success: false");
  assert.match(jsonContrib.error, /session expired|sign in/i, "Error message must indicate authentication required");

  // 2. Unauthenticated request to update-settings returns 401
  const resSettings = await fetch(`${supabaseUrl}/functions/v1/admin-api?action=update-settings`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ btc_address: "test", bsc_address: "test" })
  });
  assert.equal(resSettings.status, 401, "Unauthenticated request to action=update-settings must return HTTP 401");

  // 3. Unauthenticated request to save-cms returns 401
  const resCms = await fetch(`${supabaseUrl}/functions/v1/admin-api?action=save-cms`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ projectTitle: "Hacked" })
  });
  assert.equal(resCms.status, 401, "Unauthenticated request to action=save-cms must return HTTP 401");

  // 4. Unauthenticated request to change-credentials returns 401
  const resCreds = await fetch(`${supabaseUrl}/functions/v1/admin-api?action=change-credentials`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username: "Hacked", password: "NewPassword1234!" })
  });
  assert.equal(resCreds.status, 401, "Unauthenticated request to action=change-credentials must return HTTP 401");

  // 5. Invalid Google login token is rejected (400 or 401)
  const resGoogleBadToken = await fetch(`${supabaseUrl}/functions/v1/admin-api?action=google-login`, {
    method: "POST",
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ accessToken: "invalid-token-12345" })
  });
  assert.ok(
    [400, 401, 403].includes(resGoogleBadToken.status),
    `Invalid or missing token must be rejected with 400, 401, or 403 (got ${resGoogleBadToken.status})`
  );
});

test("R3/R4: Admin Console DOM is Protected by Default", async () => {
  const htmlPath = path.join(BASE_DIR, "public", "abcdauth", "index.html");
  const html = await fs.readFile(htmlPath, "utf-8");

  // Ensure dashboard section starts with hidden class
  assert.match(
    html,
    /<section[^>]*id="dashboard"[^>]*class="[^"]*hidden[^"]*"/,
    "#dashboard must have class 'hidden' on initial load to prevent unauthenticated access"
  );

  // Refresh and logout buttons start hidden
  assert.match(
    html,
    /<button[^>]*id="refresh-btn"[^>]*class="[^"]*hidden[^"]*"/,
    "#refresh-btn must start hidden"
  );
  assert.match(
    html,
    /<button[^>]*id="logout"[^>]*class="[^"]*hidden[^"]*"/,
    "#logout must start hidden"
  );
});
