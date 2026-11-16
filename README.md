# Epstein Foundation — For Children.

Direct community support page with on-chain transaction verification and a live verified supporter leaderboard.

## Official Channels
- **Instagram:** https://www.instagram.com/epsteinfoundationforchildren
- **X:** https://x.com/epsteinfnd

## Deployment
This project serves static files from `public/` and uses Supabase Edge Functions for server-side verification.

- **Vercel / Netlify / Cloudflare Pages:** Set the publish/output directory to `public` (and keep `vercel.json` / `netlify.toml` at the repository root).
- **Local preview:**
  ```bash
  python -m http.server 4173 --directory public
  ```
