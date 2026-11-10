# DSS testing

## Automated (what `npm run verify` runs)
`npm run verify` = `scripts/verify-m4.ts` (Module 4 smoke check), then `scripts/verify-dss.ts`:
1. `tsc --noEmit` (whole project)
2. ESLint with `--max-warnings=0` on every TS/TSX file this branch adds or changes. Four large legacy files that DSS only touched lightly are listed in `LEGACY_LINT_DEBT` (they have pre-existing errors).
3. Vitest: engine unit tests, snapshot mapper, component tests (jsdom), DB access-rule tests, notification tests, admin tests and the **simulated clinic day** (DB). It fails loudly on the first broken step.
4. `scripts/dss-simulate.ts`: an engine-only replay of an evening. It fails if the mean estimate error is above 15 min.
5. `next build`, then `next start -p 3105` and the HTTP endpoint tests (`tests/dss/api`).

Useful flags: `npx tsx scripts/verify-dss.ts --skip-build` (no build or HTTP), `--skip-db` (no database needed). Set `DSS_BASE_URL=http://localhost:3000` to reuse a running server.

DB-backed tests use the **dev-only test accounts** and only touch their data. They need `DSS_DEV_SEED=1` (verify sets it) and the linked Supabase project (`supabase/.temp/pooler-url` + `db_pass` in `.env.local`).

## Test accounts (dev only)
Create or refresh them with `npm run dss:seed`. The shared password is `DSS_TEST_PASSWORD` in `.env.local`; it is generated on the first run and never committed.

| Key | Role | Email | Notes |
|---|---|---|---|
| admin | admin | dss.admin@clinic.test | |
| doctorA | doctor | dss.doctor.a@clinic.test | "Dr. DSS Rahman (Test)", 10-min slots |
| doctorB | doctor | dss.doctor.b@clinic.test | |
| compA1, compA2 | compounder | dss.comp.a1 / a2@clinic.test | assigned to doctor A |
| compB | compounder | dss.comp.b@clinic.test | assigned to doctor B only |
| patient1 | patient | dss.patient.1@clinic.test | owns "DSS Patient One" + family member "DSS Family Member" |
| patient2 | patient | dss.patient.2@clinic.test | owns the "DSS Filler n" patients |

**Quick login** (dev only: `DSS_DEV_SEED=1`, a `DSS_TEST_PASSWORD`, and localhost):
`http://localhost:3000/api/dev/login-as?as=<key>&next=<path>`, for example `?as=compA1&next=/compounder/queue`. It returns 404 anywhere else.

## Manual checklist (≈15 min, two browser windows)
Prepare: run `npm run dev`, then `DSS_DEV_SEED=1 npx tsx scripts/dss/demo-day.ts`. This books 8 patients for doctor A on 10-minute slots from 30 min ago (serials 1, 2, 5 checked in; Patient One holds **serial 4**, their family member serial 3) and seeds 20 past visits of about 9 min.
Window A (normal) = compounder; window B (private/incognito) = patient.

| # | Action | You should see |
|---|---|---|
| 1 | A: open `/api/dev/login-as?as=doctorA&next=/doctor/queue`, tap **Start session** | Banner "Active · started HH:MM · ~30 min late"; toast "Session started, 30 min late." Then switch A to the compounder: `/api/dev/login-as?as=compA1&next=/compounder/queue` |
| 2 | B: open `/api/dev/login-as?as=patient1&next=/patient/dashboard` | Two panels: *Family Member* (serial 3) and *Patient One* (serial 4), both "Not arrived", with "Please arrive by HH:MM and tell the compounder your UHID or serial number." |
| 3 | A: search "DSS-T-0001" (or serial 4) in *Today's list* → **Check in** | Toast "Serial 4 checked in."; row shows "Arrived"; Undo bar with a 2:00 countdown |
| 4 | B: wait ≤15 s (no reload) | Patient One panel: My serial 4, Now serving, Ahead of me N, Estimated wait "a–b min", Booked vs Expected, a label (On time / Running late …), one-line reason. Bell shows "You are checked in" |
| 5 | A: tap **Call #n** / **Done · Call #n** a few times | Now-serving card and timer change on A; B's "Now serving" and "Ahead of me" update within ~15 s; at 0 ahead B shows "You are next", and when called "Please go to the doctor now" (bell too) |
| 6 | Wait until a not-arrived patient is >10 min past their slot (serial 3 is right away) | Suggestion "Serial 3 hasn't arrived … Skip for now?" (info); after 30 min "Mark as no-show?" (warning) with a confirm dialog |
| 7 | A: **Add walk-in** → search "DSS-T-1006" → pick → Normal / Emergency | Box "Adds about N min for the last M patient(s)" (or "Nobody waiting is pushed back") before **Confirm** |
| 8 | A: **Pause** (reason "Prayer") → wait → **Resume** | Banner "Paused · Prayer"; Call buttons disabled; B's panel says "Doctor is on a short break"; bell on B: "Doctor is on a short break" then "Doctor has resumed" |
| 9 | A: **Notify waiting** → 25 → Send | Dialog previews the text and recipient count; B's bell: "The doctor is running about 25 min late…" (exactly once) |
| 10 | B: view source / Network tab on `/patient/dashboard` and `/api/queue/my-status` | Only your own serial, the serial being served, ahead count, your estimate. No other names, UHIDs or serials |
| 11 | A: Done until empty, then **End session** → confirm → suggestion **Resolve remaining** → confirm | Summary bar: Seen / Waiting / Not arrived / No-shows / Avg visit / Delay; after resolving, the remaining patients are no-shows and get a rebook link |
| 12 | A: `/api/dev/login-as?as=admin&next=/admin/queue-reports` (today) and `/admin/queue-board` | Doctor A row: booked, seen, no-show %, walk-in %, average visit, start delay, first-estimate error, busiest wait hour; board shows the session "Ended" |

Reset at any time: `DSS_DEV_SEED=1 npx tsx scripts/dss/demo-day.ts` (or `--empty`).
