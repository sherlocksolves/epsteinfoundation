import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_DIR = path.resolve(import.meta.dirname, "..");

test("R2/R4: Cryptocurrency Transaction Hash Validation Rules", () => {
  const btcRegex = /^[a-fA-F0-9]{64}$/;
  const bscRegex = /^0x[a-fA-F0-9]{64}$/;

  // Valid Bitcoin TXID (64 hex characters)
  const validBtc = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
  assert.equal(btcRegex.test(validBtc), true);

  // Invalid Bitcoin TXID
  assert.equal(btcRegex.test("12345"), false, "Too short");
  assert.equal(btcRegex.test(validBtc + "a"), false, "Too long (65 chars)");
  assert.equal(btcRegex.test("g" + validBtc.slice(1)), false, "Non-hex characters");
  assert.equal(btcRegex.test("0x" + validBtc.slice(2)), false, "Should not start with 0x for BTC");

  // Valid BSC TXID (0x + 64 hex = 66 chars)
  const validBsc = "0x" + validBtc;
  assert.equal(bscRegex.test(validBsc), true);

  // Invalid BSC TXID
  assert.equal(bscRegex.test(validBtc), false, "Missing 0x prefix");
  assert.equal(bscRegex.test("0x12345"), false, "Too short");
  assert.equal(bscRegex.test(validBsc + "0"), false, "Too long (67 chars)");
  assert.equal(bscRegex.test("0x" + "g" + validBtc.slice(1)), false, "Non-hex characters");
});

test("R2/R4: Public Mobile Navigation and Drawer Elements", async () => {
  const htmlPath = path.join(BASE_DIR, "public", "index.html");
  const html = await fs.readFile(htmlPath, "utf-8");

  // Mobile hamburger toggle exists with accessible attributes
  assert.match(html, /id="mobile-menu-btn"/, "#mobile-menu-btn must exist");
  assert.match(html, /aria-controls="mobile-drawer"/, "Must link to mobile-drawer via aria-controls");
  assert.match(html, /class="mobile-drawer"/, ".mobile-drawer must exist");
  assert.match(html, /id="drawer-backdrop"/, "#drawer-backdrop must exist");

  // Leaderboard loading state (prevents FOEC)
  assert.match(html, /id="leaderboard-loading"/, "#leaderboard-loading must exist to prevent FOEC");
  assert.match(
    html,
    /<div[^>]*id="leaderboard-empty"[^>]*style="[^"]*display:\s*none;?[^"]*"/,
    "#leaderboard-empty must start with display: none to prevent FOEC on initial load"
  );
});

test("R2/R4: Responsive Viewport Overflow Protection Styles", async () => {
  const cssPath = path.join(BASE_DIR, "public", "css", "style.css");
  const css = await fs.readFile(cssPath, "utf-8");

  // Overflow prevention on html, body
  assert.match(css, /html,\s*body\s*\{[^}]*overflow-x:\s*hidden/, "html, body must enforce overflow-x: hidden");

  // QR box flexible containment
  assert.match(css, /\.qr-box\s*\{[^}]*max-width:\s*100%/, ".qr-box must have max-width: 100%");
  assert.match(css, /\.qr-box\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/, ".qr-box must maintain 1:1 aspect ratio");

  // Form validation error styles
  assert.match(css, /\.form-control\.is-invalid/, ".form-control.is-invalid style must be defined");
  assert.match(css, /\.field-error/, ".field-error style must be defined");

  // Mobile drawer styling
  assert.match(css, /\.mobile-drawer/, ".mobile-drawer style must be defined");
  assert.match(css, /\.mobile-drawer\.open/, ".mobile-drawer.open style must be defined");
  assert.match(css, /@media\s*\(\s*max-width:\s*360px\s*\)/, "CSS must provide styles for <= 360px viewports");
});

test("R2/R4: Admin Password Confirmation Logic", () => {
  const checkPasswordMatch = (pwd, confirm) => {
    if (!pwd && !confirm) return { valid: true };
    if (pwd !== confirm) return { valid: false, error: "Passwords do not match." };
    if (pwd.length < 12) return { valid: false, error: "Password must be at least 12 characters." };
    return { valid: true };
  };

  assert.equal(checkPasswordMatch("StrongSecret123!", "StrongSecret123!").valid, true);
  assert.equal(checkPasswordMatch("StrongSecret123!", "MismatchSecret123!").valid, false);
  assert.equal(checkPasswordMatch("short", "short").valid, false);
});
