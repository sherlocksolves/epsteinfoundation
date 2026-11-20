# Epstein Foundation — For Children.

Direct community support web application with on-chain cryptocurrency transaction verification, live supporter leaderboard, and private administrator console.

## Official Channels
- **Instagram:** https://www.instagram.com/epsteinfoundationforchildren
- **X:** https://x.com/epsteinfnd

## Architecture & Features
- **Frontend:** Vanilla HTML5, CSS3, and modern ES modules in `public/`.
- **Public Support:** Direct Bitcoin (BTC Mainnet) and BNB Smart Chain (BEP-20) donation cards with interactive QR codes and copy buttons.
- **Verification:** On-chain verification via Supabase Edge Functions (`verify-btc`, `verify-bsc`) updating the live public leaderboard in real time.
- **Volunteer & Community Feedback:** Dedicated volunteer and partner submission system in `public/index.html`.
- **Admin Console:** Private command center at `/abcdauth` supporting Google OAuth sign-in and encrypted session token authentication.
- **Security:** Strict Content-Security-Policy (CSP), restricted CORS origins, hardened Supabase Row Level Security (RLS), and rate limiting.

## Automated Testing
Run the automated test suite using the Node 24 native test runner:
```bash
npm test
```

## Local Development
Run a local static server:
```bash
npm run dev
# or:
python -m http.server 4173 --directory public
```

## Deployment
- **Vercel:** Configured via `vercel.json` with `outputDirectory: "public"` and clean rewrite rules for `/abcdauth`.
- **Netlify:** Configured via `netlify.toml` with `publish = "public"` and SPA redirects.
