import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_DIR = path.resolve(import.meta.dirname, "..");

test("R2/R4: Public Website Wallet Addresses and Initial Button States", async () => {
  const htmlPath = path.join(BASE_DIR, "public", "index.html");
  const html = await fs.readFile(htmlPath, "utf-8");

  // Copy buttons must start disabled until addresses load
  assert.match(
    html,
    /<button[^>]*id="btn-copy-address"[^>]*disabled/,
    "#btn-copy-address must start with disabled attribute to prevent copying placeholders"
  );
  assert.match(
    html,
    /<button[^>]*id="btn-copy-uri"[^>]*disabled/,
    "#btn-copy-uri must start with disabled attribute to prevent copying placeholders"
  );

  // Address text element must exist
  assert.match(html, /id="card-address-text"/, "#card-address-text must be present");

  // QR slot must exist
  assert.match(html, /id="card-qr-slot"/, "#card-qr-slot must be present");
});

test("R2/R4: Fallback Static Configuration Validates Wallet Address Formats", async () => {
  const appJsPath = path.join(BASE_DIR, "public", "js", "app.js");
  const content = await fs.readFile(appJsPath, "utf-8");

  // Extract BTC address from serverConfig in app.js
  const btcMatch = content.match(/btc:\s*\{[^}]*address:\s*["']([^"']+)["']/);
  assert.ok(btcMatch, "app.js serverConfig must define BTC address");
  const btcAddr = btcMatch[1];
  assert.match(btcAddr, /^bc1[a-z0-9]{38,60}$/, `BTC address (${btcAddr}) must be a valid bech32 address starting with bc1`);

  // Extract BSC address from serverConfig in app.js
  const bscMatch = content.match(/bsc:\s*\{[^}]*address:\s*["']([^"']+)["']/);
  assert.ok(bscMatch, "app.js serverConfig must define BSC address");
  const bscAddr = bscMatch[1];
  assert.match(bscAddr, /^0x[a-fA-F0-9]{40}$/, `BSC address (${bscAddr}) must be a valid Ethereum-compatible 42-char address`);
});

test("R2/R4: Live Supabase Backend get-public-config Serves Verified Addresses", async () => {
  const initPath = path.join(BASE_DIR, "public", "js", "supabase-init.js");
  const initContent = await fs.readFile(initPath, "utf-8");
  const urlMatch = initContent.match(/SUPABASE_URL\s*=\s*["']([^"']+)["']/);
  const keyMatch = initContent.match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*["']([^"']+)["']/);

  assert.ok(urlMatch && keyMatch, "Must find SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY");
  const supabaseUrl = urlMatch[1];
  const apiKey = keyMatch[1];

  const res = await fetch(`${supabaseUrl}/functions/v1/get-public-config`, {
    headers: { apikey: apiKey }
  });

  assert.equal(res.status, 200, "get-public-config must return HTTP 200");
  const data = await res.json();
  assert.equal(data.success, true, "Response must report success: true");
  assert.ok(data.data?.btc?.address, "Must return active BTC receiving address");
  assert.ok(data.data?.bsc?.address, "Must return active BSC receiving address");
  assert.match(data.data.btc.address, /^bc1[a-z0-9]+$/, "Live BTC address must be valid bech32");
  assert.match(data.data.bsc.address, /^0x[a-fA-F0-9]{40}$/, "Live BSC address must be valid hex");
});
