# Deployment checklist (host-neutral)

The app is a Next.js (App Router) server app with API routes, server actions and a proxy (middleware). It needs a host that runs
Next.js on a server runtime, not a static export. This page lists what any host needs; host-specific steps are not covered.

## 1. Build
```bash
npm ci
npm run build
```

## 2. Environment variables
Set the names in `.env.example` in the host's settings. Required for the main features:

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | database, auth, storage |
| `NEXT_PUBLIC_APP_URL` | public URL of the site (links, payment callbacks); must be the real address |
| `JWT_SECRET`, `EXTRACTION_CRON_SECRET` | session tokens, protected background endpoint |
| `OPENROUTER_API_KEY`, `EXTRACTION_MODEL` | lab report vision |
| `ELEVENLABS_API_KEY`, `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` | Aura voice assistant |
| `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_IS_SANDBOX` | payment (keep `true` for demos) |

`SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `OPENROUTER_API_KEY`, `ELEVENLABS_API_KEY` and the SSLCommerz values are secrets:
set them only in the host's secret store.

## 3. Never set on a public site
`DSS_DEV_SEED`, `DSS_TEST_PASSWORD`, `NEXT_PUBLIC_DEV_QUICK_LOGIN`. They turn on the developer quick-login. The route
`/api/dev/login-as` also refuses non-localhost requests, but leave the variables unset anyway.

## 4. Database
Migrations are in `supabase/migrations/`. The online project must have all of them, including
`20261123000000_dss_full_engine_settings.sql` (queue engine switch). `dss_settings.engine_mode` is `dss` by default:
screens behave as before until an admin selects the full engine in Admin > Queue Settings.

## 5. Supabase Auth
In the Supabase dashboard (Authentication > URL configuration) set the Site URL to the public address and add it to the
redirect URLs, otherwise login redirects fail.

## 6. Before a demo
- Open the site once a few minutes earlier (cold start).
- Check third-party credit: OpenRouter, ElevenLabs.
- Use demo accounts and fake patients only; keep credentials out of the repository.
- Run through `docs/DEMO.md`.
