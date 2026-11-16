# Direct Support App — Supabase Edition

Static frontend + Supabase Postgres and Edge Functions. Firebase / Firestore / Cloud Functions / App Check have been removed.

## Connected Supabase project

- Project: `direct-support-app`
- Ref: `elndnwiujkghclblnuyl`
- Region: Mumbai (`ap-south-1`)
- URL: `https://elndnwiujkghclblnuyl.supabase.co`
- Browser key: publishable key in `public/js/supabase-init.js` (safe to expose with RLS)
- Project creation quote: $0/month; usage limits and future plan changes are governed by Supabase.

## Deploy / synchronize database

The connected project was created in Supabase. Apply the SQL migration if setting up a fresh project:

```bash
supabase link --project-ref elndnwiujkghclblnuyl
supabase db push
```

Migration: `supabase/migrations/20261116000100_supabase_backend.sql`.

## Edge Functions

Functions included under `supabase/functions/`:

- `get-public-config` — public receiving addresses and wallet QR URIs
- `verify-btc` — Mempool.space transaction verification and duplicate prevention
- `verify-bsc` — BNB Smart Chain native BNB / BEP-20 Transfer verification
- `admin-api` — signed short-lived admin sessions, contribution listing, address updates, moderation and credential changes

The functions use Supabase's automatically injected `SUPABASE_SECRET_KEYS` (or legacy `SUPABASE_SERVICE_ROLE_KEY`) server-side. **Never copy a secret/service-role key into the public website.**

Deploy with the Supabase CLI (requires login and project access):

```bash
supabase functions deploy get-public-config --no-verify-jwt
supabase functions deploy verify-btc --no-verify-jwt
supabase functions deploy verify-bsc --no-verify-jwt
supabase functions deploy admin-api --no-verify-jwt
```

All four functions implement their own method validation; the admin function additionally validates an HMAC-signed JWT session on every protected operation. The signing key is derived inside the Edge Function from the project's secret API key and never leaves the server. Session lifetime: 2 hours.

## Initial administrator

- Username: `Admin`
- Initial password: `Password@1234@`
- Password stored as PBKDF2-HMAC-SHA256 with 310,000 iterations and a unique salt.

Sign in at `/abcdauth` and immediately change the password and username under Account Settings. The new password must be at least 12 characters. Do not reuse the initial password.

## Frontend hosting

This is a static site; publish the `public/` directory on Netlify or Cloudflare Pages. For Vercel, keep `vercel.json` at the project root. `/abcdauth` routing is configured in `vercel.json`, `netlify.toml`, and `public/_redirects`.

- Vercel: import the project and set the output directory to `public` (or use the included config).
- Netlify: publish directory `public`.
- Cloudflare Pages: build command empty; output directory `public`.

The frontend already contains the connected Supabase project URL and public publishable key. Those values are intentionally public. No service-role key is present in the ZIP.

## Database security

RLS is enabled on every table. `private_contributions`, `app_settings`, `admin_users`, and `verification_rate_limits` deny all direct `anon` and `authenticated` access. `public_leaderboard` allows SELECT only for verified rows; public INSERT/UPDATE/DELETE are revoked and blocked. Edge Functions use the server secret key for privileged reads/writes.

## Important operational notes

- The initial admin password is intentionally seeded as a hash; change it immediately after first login.
- Public transaction verification and administrator login share an IP-based rolling rate limit (8 requests per 10 minutes). The rate-limit records contain hashed IP identifiers, not raw IP addresses.
- BTC verification checks for a positive output to the configured address. Unconfirmed mempool transactions may be accepted if Mempool.space returns the transaction; the UI labels the result as verified, not as a finality guarantee.
- BSC BEP-20 verification checks the standard `Transfer` event recipient and reads token decimals; the public amount label uses a generic BEP-20 marker. Token contracts are not allowlisted; only accept tokens you intend to support.
- The supplied archive contained `public/assets/banner.svg` but did not contain `public/assets/logo.jpg` or `public/assets/banner.jpg`; the existing banner asset is preserved and used. The existing `public/js/siteConfig.js` and `public/js/qr-generator.js` are preserved.
- The leaderboard uses Supabase Realtime; if Realtime is disabled for the project, the initial list still loads and a page refresh will show updates.

## Local preview

Serve the `public/` directory using any static server. Browser ES modules require HTTP(S), not `file://`.

```bash
python -m http.server 4173 --directory public
```

Open `http://localhost:4173`.
