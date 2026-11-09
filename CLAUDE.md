@AGENTS.md

## Live Queue & Decision Support (DSS)
- **Rule: all queue changes go through the `dss_*` database functions** (SECURITY DEFINER, caller check via `dss_can_manage`, per-doctor-day advisory lock, request-key idempotency, one `queue_events` row each). App code calls them only through `lib/queue/actions.ts` (`queueAction`). Never update `appointments` queue columns directly; a trigger rejects it.
- Engine (pure TS, no Supabase/Next): `lib/queue/engine/`: `computeQueueOrder`, `computeExpectedDurations`, `computeEstimates`, `computeSuggestions`, `runEngine`.
- Data: `dss_snapshot_input` RPC → `lib/queue/snapshotInput.ts#toEngineInput` → engine. Server: `lib/queue/server.ts` (`getQueueSnapshot`, `getMyStatus`, `syncEstimates`). APIs: `/api/queue/snapshot` (staff), `/api/queue/my-status` (patients).
- Notifications: table `notifications`, created by the `dss_queue_event_notify` trigger and `dss_sync_estimates`; UI in `components/notifications/`.
- Screens: `/compounder/queue`, `/doctor/queue`, patient panel `components/queue/PatientLiveQueueCard.tsx`, `/admin/queue-settings|queue-board|queue-reports`.
- Tests: `npm run test:dss` (DB tests need `DSS_DEV_SEED=1`), full gate `npm run verify`, engine replay `npm run dss:simulate`. Dev accounts: `npm run dss:seed`; demo day `npx tsx scripts/dss/demo-day.ts`.
- Migrations: `node scripts/dss/apply-migration.mjs supabase/migrations/<file>.sql` applies and records one (what `supabase db push` would do).
- Docs: `docs/dss-audit.md`, `docs/dss-progress.md`, `docs/dss-testing.md`.
