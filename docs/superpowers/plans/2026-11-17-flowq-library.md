# flowq library (engine + simulator + benchmark + event log + analysis) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the queue engine into a reusable, app-free package `packages/flowq` and add lab-line support, routing and return advice, a seeded hospital-day simulator, a benchmark against baselines, OCEL 2.0 / XES export and a PM4Py analysis pipeline.

**Architecture:** `packages/flowq/src` is plain TypeScript with zero runtime dependencies and no imports from the app (`@/`, Supabase, Next). The app keeps importing `@/lib/queue/engine`, which becomes a re-export. The simulator calls the same engine the app uses, so benchmark numbers describe the deployed logic. The Python analysis reads only the exported files.

**Tech Stack:** TypeScript 5, Vitest, tsx (existing). Python 3.13 + uv + pm4py + pandas + matplotlib + pytest (new, isolated in `analysis/`).

**Spec:** `docs/superpowers/specs/2026-11-17-hospital-flow-lab-design.md`

## Roadmap (all plans)

| Plan | Content | Touches DB | Est. solo time |
|---|---|---|---|
| **1 (this file)** | flowq package, lab-line + routing + return logic, simulator, benchmark, export, analysis | no (Task 11 reads only) | 6–8 days |
| 2 | Web app lab module: `lab_staff` role, `lab_lines`, `lab_test_types`, `lab_orders`, `lab_queue_items`, `lab_events`, RPCs, `/lab` console, doctor test order, compounder now/later, report-ready + return suggestion, admin config | yes (migrations need owner go-ahead before push) | 8–10 days |
| 3 | Paper package: cited scenario values, sensitivity runs, figures, fresh public repo (`git subtree split` of `packages/flowq` + `analysis/`), README, Zenodo DOI, SoftwareX manuscript (Overleaf) | no | 5–7 days |

Supervisor's "3 implemented before the meeting" = Plan 1 Tasks 1–5 (engine + lab logic), 6–10 (simulator + benchmark + export), 12 (analysis). Plan 2 is written after Plan 1 lands, from the same spec.

Tools needed: Node/npm, tsx, Vitest (present); `uv` (present) for Python; Supabase CLI 3.1.0 (present, Plan 2 only); Playwright (present, Plan 2 UI checks); Overleaf (Plan 3). No paid APIs.

## Global Constraints

- `packages/flowq/src/**` must not import from `@/`, `next`, `@supabase/*`, `react`, or `node:*` (CLI files under `packages/flowq/cli/` may use `node:*`).
- All instants are epoch milliseconds (UTC); durations are minutes. Display zone Asia/Dhaka (UTC+6, no DST).
- Existing behaviour is frozen: `npm run test:dss` engine tests and `npm run dss:simulate` must pass unchanged after Task 1.
- Same seed + same scenario ⇒ byte-identical simulator output.
- Report review: `visitReason = 'report_review'`, duration setting `reportReviewMin` default 4.
- Return advice: same-day only if `reportReadyAt + travelBufferMin(10) + queueWaitMin ≤ scheduledEndAt − endMarginMin(10)`.
- Routing: tests flagged `mustFirst` first, then ascending expected wait, ties by line id.
- No commits without the owner's approval in chat (harness rule); "Commit" steps mean "stage and report".

## Review Focus

1. Empty lab line or closed line session — routing must skip a closed line and still return the open ones; estimates for an empty line are an empty result, not NaN. (Task 4, Task 3 tests)
2. Report ready after the doctor's session already ended, or doctor has no session today — return advice must say `book_later`, never `same_day`. (Task 5 test)
3. Walk-in / lab items have no booked time — no NaN may reach `expectedStartAt`, labels or metrics. (Task 3 test)
4. Undo events in the DB log — the undone event and the undo row both vanish from the exported log. (Task 11 test)
5. Zero-patient simulated day (all no-shows) — benchmark metrics are `null`, not NaN, and CSV writes empty cells. (Task 10 test)

---

### Task 1: Move engine into `packages/flowq`

**Files:**
- Create: `packages/flowq/package.json` (`"name": "flowq"`, `"version": "0.1.0"`, `"type": "module"`, `"private": true`, `"main": "src/index.ts"`, license MIT)
- Move: `lib/queue/engine/{types,durations,order,estimates,suggestions,time}.ts` → `packages/flowq/src/engine/` (git mv)
- Create: `packages/flowq/src/engine/index.ts` (content of old `lib/queue/engine/index.ts`), `packages/flowq/src/index.ts` (`export * from './engine'`)
- Modify: `lib/queue/engine/index.ts` → `export * from '../../../packages/flowq/src/engine';`
- Test: `tests/flowq/boundary.test.ts`

**Interfaces:**
- Produces: everything the old engine exported, unchanged names, importable from `packages/flowq/src`.

- [ ] Step 1: Write `tests/flowq/boundary.test.ts`: reads every `.ts` under `packages/flowq/src` and asserts no line matches `/from ['"](@\/|next|@supabase|react|node:)/`.
- [ ] Step 2: Run `npx vitest run tests/flowq/boundary.test.ts` — expect FAIL (folder missing).
- [ ] Step 3: Do the moves and re-export.
- [ ] Step 4: Run `npx vitest run tests/flowq tests/dss/engine` and `npm run dss:simulate` and `npx tsc --noEmit -p .` — expect all PASS, simulator prints its table and exits 0.
- [ ] Step 5: Stage and report.

### Task 2: Report-review visits in the engine

**Files:**
- Modify: `packages/flowq/src/engine/types.ts` (add `visitReason?: 'consult' | 'report_review'` to `QueueAppointment`; `reportReviewMin: number` to `DssSettings`, default `4`)
- Modify: `packages/flowq/src/engine/estimates.ts` (use `durationOf(a, durations, s)` wherever `durations[a.visitType]` is read)
- Create: `packages/flowq/src/engine/visit.ts`
- Modify: `lib/queue/snapshotInput.ts` (`reportReviewMin: n('report_review_min', DEFAULT_SETTINGS.reportReviewMin)`)
- Test: `tests/flowq/report-review.test.ts`

**Interfaces:**
- Produces: `durationOf(a: QueueAppointment, d: Durations, s: DssSettings): DurationStats` — report review returns `{ typical: s.reportReviewMin, short: clamp(0.7×), long: clamp(1.4×), source: 'slot', samples: 0 }`, otherwise `d[a.visitType]`.

- [ ] Step 1: Test `report review ahead adds reportReviewMin`: line = [report_review A (checked in 18:00), new B (18:01)], doctor free now (active, nobody in room) at 18:05 → `estimates[B].expectedStartAt === now + 4*MIN`. Test `default setting is 4`: `DEFAULT_SETTINGS.reportReviewMin === 4`.
- [ ] Step 2: Run — FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run `npx vitest run tests/flowq tests/dss/engine` — PASS.
- [ ] Step 5: Stage and report.

### Task 3: Lab line estimates

**Files:**
- Create: `packages/flowq/src/lab/line.ts`, `packages/flowq/src/lab/types.ts`, `packages/flowq/src/lab/index.ts`; export from `src/index.ts`
- Test: `tests/flowq/lab-line.test.ts`

**Interfaces:**
- Produces (types.ts):
  - `LabLine = { id: string; name: string; typicalMin: number }`
  - `LabItem = { id: string; lineId: string; patientId: string; queuedAt: number; status: 'queued' | 'called' | 'collected' | 'skipped' | 'cancelled'; calledAt?: number | null; collectedAt?: number | null; priorityLevel: PriorityLevel }`
  - `LineInput = { now: number; settings: DssSettings; session: SessionInfo; line: LabLine; items: LabItem[]; history: number[] }`
- Produces (line.ts): `computeLineEstimates(input: LineInput): QueueResult` — maps each item to a `QueueAppointment` with `bookedAt = queuedAt`, `checkedInAt = queuedAt`, `visitType 'new'`, `visitSource 'walk_in'`, status map queued→checked_in, called→in_consultation (`consultStartedAt = calledAt`), collected→completed, skipped→checked_in with `skippedAt`, cancelled→cancelled; `slotMinutes = line.typicalMin`; history `{ new: input.history, follow_up: [] }`; then `computeEstimates`.
  - `expectedWaitMin(result: QueueResult): number` — minutes until a new item joining now would start (`doctorFreeInMin` + sum of typical of the line), 0 for an empty open line, `Infinity` when session state is `ended` or `not_started`.

- [ ] Step 1: Tests — `three queued items, typical 5, line free`: expected starts at now, now+5, now+10 min; `no NaN for items without booking` (every numeric field finite or null); `empty open line → expectedWaitMin 0`; `ended line → Infinity`.
- [ ] Step 2: Run — FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run — PASS.
- [ ] Step 5: Stage and report.

### Task 4: Routing advice

**Files:**
- Create: `packages/flowq/src/lab/routing.ts`
- Test: `tests/flowq/routing.test.ts`

**Interfaces:**
- Produces: `suggestRoute(pending: { lineId: string; mustFirst: boolean }[], waits: Record<string, number>): string[]` — unique line ids; `mustFirst` lines first; within each group ascending `waits[lineId]`, ties by `lineId`; lines with `Infinity` wait (closed) go last, never dropped.

- [ ] Step 1: Tests — `blood (mustFirst, wait 20) before xray (wait 5)`; `shortest wait first when no mustFirst`: urine 10, ecg 3 → [ecg, urine]; `duplicate tests in one line counted once`; `closed line last`.
- [ ] Step 2–4: FAIL → implement → PASS.
- [ ] Step 5: Stage and report.

### Task 5: Return advice

**Files:**
- Create: `packages/flowq/src/lab/returnAdvice.ts`
- Test: `tests/flowq/return-advice.test.ts`

**Interfaces:**
- Produces: `adviseReturn(a: { reportReadyAt: number; doctorSession: SessionInfo | null; queueWaitMin: number; travelBufferMin?: number; endMarginMin?: number }): { kind: 'same_day'; expectedStartAt: number } | { kind: 'book_later'; reason: 'no_session' | 'session_ended' | 'not_enough_time' }` — defaults 10 and 10; same-day when session state is `active` or `paused` (or `not_started` with a `scheduledEndAt`) and `reportReadyAt + (travel + wait)·MIN ≤ scheduledEndAt − margin·MIN`.

- [ ] Step 1: Tests — ready 19:00, session ends 21:00, wait 30 → same_day at 19:40; ready 20:30, ends 21:00, wait 15 → book_later `not_enough_time`; session ended → `session_ended`; null session → `no_session`.
- [ ] Step 2–4: FAIL → implement → PASS.
- [ ] Step 5: Stage and report.

### Task 6: Random numbers and scenario file

**Files:**
- Create: `packages/flowq/src/sim/rng.ts`, `packages/flowq/src/sim/scenario.ts`, `packages/flowq/scenarios/default.json`
- Test: `tests/flowq/rng-scenario.test.ts`

**Interfaces:**
- Produces (rng.ts): `makeRng(seed: number): Rng` with `next(): number` (mulberry32, [0,1)), `normal(mean, sd)`, `lognormalMin(medianMin, cv)` (σ = √ln(1+cv²), μ = ln(median)), `bernoulli(p)`, `poissonTimes(ratePerHour, fromMs, toMs): number[]`, `pick<T>(xs: T[]): T`.
- Produces (scenario.ts): type `Scenario` and `parseScenario(json: unknown): Scenario` (throws `Error('scenario.<path>: <reason>')` on missing/negative fields). Fields:
  - `day: { date: string }`
  - `doctors: { id; sessionStart: 'HH:MM'; sessionEnd: 'HH:MM'; slotMin; bookedCount; startLateMeanMin; startLateSdMin; pause?: { at: 'HH:MM'; min } }[]`
  - `visits: { newMedianMin; followUpMedianMin; cv; followUpShare }`
  - `patients: { latenessMeanMin; latenessSdMin; noShowP; walkInPerHour; emergencyShareOfWalkIns }`
  - `lab: { orderP; testsPerOrder: [min, max]; nowP; outsidePerHour; lines: { id; name; typicalMin; cv; mustFirst; turnaroundMin; share }[] }`
  - `returns: { sameDayWillingP; travelBufferMin }`
  - `sources: Record<string, string>` (citation per field group; Plan 3 fills real citations)
- `default.json` values: 3 doctors 18:00–21:00 slot 10, bookedCount 16, start late mean 5 sd 5; one doctor pause 19:20 for 10; newMedianMin 9, followUpMedianMin 6, cv 0.4, followUpShare 0.3; lateness mean 0 sd 10, noShowP 0.12, walkInPerHour 2, emergencyShareOfWalkIns 0.05; orderP 0.35, testsPerOrder [1,3], nowP 0.8, outsidePerHour 6; lines blood(4, cv .3, mustFirst true, turnaround 120, share .45), urine(2, .3, false, 60, .25), ecg(8, .3, false, 0, .15), xray(6, .3, false, 60, .15); sameDayWillingP 0.7, travelBufferMin 10.

- [ ] Step 1: Tests — `same seed same sequence` (first 5 `next()` equal across two rngs); `lognormal median ≈ median` (10k draws, sample median within 5%); `parseScenario(default.json) ok`; `negative noShowP throws 'scenario.patients.noShowP'`.
- [ ] Step 2–4: FAIL → implement → PASS.
- [ ] Step 5: Stage and report.

### Task 7: Flow event model

**Files:**
- Create: `packages/flowq/src/log/events.ts`
- Test: covered in Task 8 and 9 tests

**Interfaces:**
- Produces: `FlowObjectType = 'patient' | 'appointment' | 'doctor' | 'doctor_session' | 'lab_line' | 'lab_order' | 'lab_queue_item'`; `FlowEvent = { id: string; activity: FlowActivity; time: number; objects: { type: FlowObjectType; id: string; qualifier?: string }[]; attrs: Record<string, string | number | boolean | null> }`; `FlowActivity` = `'book' | 'check_in' | 'walk_in' | 'call' | 'consult_start' | 'consult_end' | 'skip' | 'rejoin' | 'no_show' | 'priority_set' | 'session_start' | 'session_pause' | 'session_resume' | 'session_end' | 'lab_order' | 'lab_queue' | 'lab_call' | 'sample_collected' | 'report_ready' | 'return_queue'`.

(Types only; folded into Task 8's stage step.)

### Task 8: Hospital-day simulator

**Files:**
- Create: `packages/flowq/src/sim/simulate.ts`, `packages/flowq/src/sim/policies.ts`
- Modify: `scripts/dss-simulate.ts` stays as is (scripted regression).
- Test: `tests/flowq/simulate.test.ts`

**Interfaces:**
- Consumes: Tasks 2–7.
- Produces:
  - `type EtaPolicy = 'engine' | 'booked' | 'position_slot' | 'running_mean'`; `type RoutePolicy = 'engine' | 'fixed' | 'random' | 'shortest_line'`.
  - `simulateDay(sc: Scenario, seed: number, p: { eta: EtaPolicy; route: RoutePolicy }): SimDay`
  - `SimDay = { events: FlowEvent[]; predictions: { visitId: string; stage: 'doctor' | 'lab'; lineId: string | null; predictedAt: number; madeAt: number; low: number | null; high: number | null; actualStartAt: number | null }[]; stats: { doctorIdleMin: Record<string, number>; lineIdleMin: Record<string, number> } }`
- Behaviour: discrete-event loop (min-heap on time, ties by insertion order). Booked patients: slot = start + k·slotMin, arrival = slot + normal(lateness), or never with `noShowP`; walk-ins by `poissonTimes`. A free doctor calls the head of `computeQueueOrder` line. Consult length = lognormal by visit type (report review: lognormal(reportReviewMin, cv)). After consult, with `orderP` create 1..n lab tests (lines by `share`); with `nowP` route now, else drop. Outside lab patients arrive at `outsidePerHour`. Route order from policy (`engine` = `suggestRoute` with `expectedWaitMin` of each line). Sample time = lognormal(line typical, cv). Report ready = collected + turnaroundMin. Then `adviseReturn`; same_day and bernoulli(`sameDayWillingP`) → `return_queue` into the ordering doctor's line as report_review. A prediction is recorded once per visit at check-in (doctor) or lab queue entry, by the ETA policy: `engine` = engine `expectedStartAt`/low/high; `booked` = booked time (lab: queuedAt); `position_slot` = now + position·slotMin (lab: typicalMin); `running_mean` = now + position·mean of today's finished durations (fallback slot).
- [ ] Step 1: Tests — `deterministic`: `JSON.stringify(simulateDay(sc, 7, p))` equal twice; `no overlap`: per doctor, consult intervals do not overlap, and same per lab line; `order of stages`: for each lab item, `lab_queue ≤ lab_call ≤ sample_collected ≤ report_ready`; `every return follows a report_ready of same patient`; `all-no-show day`: `noShowP 1`, walkInPerHour 0, outsidePerHour 0 → no `consult_start` events, no throw.
- [ ] Step 2–4: FAIL → implement → PASS.
- [ ] Step 5: Stage and report.

### Task 9: OCEL 2.0 and XES export

**Files:**
- Create: `packages/flowq/src/log/ocel.ts`, `packages/flowq/src/log/xes.ts`
- Test: `tests/flowq/export.test.ts`

**Interfaces:**
- Produces: `toOcelJson(events: FlowEvent[]): object` — OCEL 2.0 JSON: `objectTypes`, `eventTypes` (with attribute names), `objects` (id, type, empty attributes, relationships none), `events` (id, type = activity, time ISO-8601 UTC, attributes, relationships = objects with qualifier). `toXes(events: FlowEvent[]): string` — one trace per patient (`concept:name` = patient id), events sorted by time, `concept:name`, `time:timestamp`, `org:resource` = attrs.role ?? '', lifecycle `complete`; XML-escaped.
- [ ] Step 1: Tests on a 6-event fixture — OCEL has all 4 top-level keys, each event's relationships reference existing objects, times end in `Z`; XES has 2 traces for 2 patients, events in time order, `&` escaped as `&amp;`.
- [ ] Step 2–4: FAIL → implement → PASS.
- [ ] Step 5: Stage and report.

### Task 10: Benchmark harness and CLI

**Files:**
- Create: `packages/flowq/src/bench/metrics.ts`, `packages/flowq/cli/bench.ts`
- Modify: `package.json` scripts: `"flowq:bench": "tsx packages/flowq/cli/bench.ts"`
- Test: `tests/flowq/metrics.test.ts`

**Interfaces:**
- Produces: `etaMetrics(preds: SimDay['predictions']): { n: number; mae: number | null; medianAe: number | null; coverage: number | null }` (only predictions with `actualStartAt`; coverage only where low/high exist); `waitMetrics(day: SimDay): { stage: 'doctor' | 'lab'; meanMin: number | null; p90Min: number | null }[]`; `journeyMinutes(day: SimDay): number[]`.
- CLI: `npm run flowq:bench -- --scenario packages/flowq/scenarios/default.json --days 500 --seed 1 --out out/bench` runs every ETA policy × route policy over seeds `seed..seed+days-1`, writes `metrics.csv` (policy, metric, value), `summary.json`, and `events-seed<seed>.ocel.json` + `.xes` for the first day of the `engine/engine` run. Prints a table.
- [ ] Step 1: Tests — `mae on known pairs` (errors 0, 10, 20 → mae 10, median 10); `coverage counts inside range` (2 of 4 → 0.5); `empty input → nulls`.
- [ ] Step 2–3: FAIL → implement.
- [ ] Step 4: Run `npx vitest run tests/flowq` — PASS; run `npm run flowq:bench -- --days 20 --out /tmp/flowq-smoke` — exits 0, `metrics.csv` has 16 policy rows × metrics.
- [ ] Step 5: Stage and report.

### Task 11: Database event-log export (read-only)

**Files:**
- Create: `lib/flow/dbLog.ts` (pure mapper), `scripts/flow/export-db-log.ts` (CLI, service role, SELECT only)
- Test: `tests/flowq/db-log.test.ts`

**Interfaces:**
- Produces: `mapQueueEvents(rows: { id; appointment_id: string | null; doctor_id; event_type; actor_role: string | null; occurred_at: string; session_id: string | null; metadata: Record<string, unknown> }[], appts: { id; patient_id; booked_at: string | null }[]): FlowEvent[]` — maps DSS canonical names (`check_in`, `call_next`→`call`+`consult_start`, `end_consult`→`consult_end`, `skip`, `rejoin`, `no_show`, `priority_set`, `walk_in_added`→`walk_in`, `session_start/pause/resume/end` from `session_start`, `pause`, `resume`, `session_end`); ignores rows without `metadata.dss = true` (legacy duplicates); removes `undo` rows and the event whose id is `metadata.undo_of`; drops duplicate `request_key`s; adds a `book` event per appointment at `booked_at`.
- CLI: `npx tsx scripts/flow/export-db-log.ts --from 2026-11-01 --to 2026-11-30 --out out/db-log` writes `.ocel.json` and `.xes`. Uses `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`; never writes to the DB.
- [ ] Step 1: Tests — `undo removes both rows`; `legacy row without dss flag ignored`; `call_next becomes call + consult_start`; `duplicate request_key kept once`.
- [ ] Step 2–4: FAIL → implement → PASS.
- [ ] Step 5: Stage and report (running the CLI against the remote DB is optional and read-only).

### Task 12: Process-mining analysis (Python)

**Files:**
- Create: `analysis/pyproject.toml` (uv project; deps `pm4py`, `pandas`, `matplotlib`; dev `pytest`), `analysis/flowq_analysis/analyze.py`, `analysis/tests/test_analyze.py`, `analysis/tests/fixtures/small.xes` (copied from Task 10 smoke output, ≤ 50 events)
- Modify: `.gitignore` add `analysis/.venv/`, `out/`

**Interfaces:**
- Consumes: `.xes` and `.ocel.json` from Tasks 9–11.
- Produces: `python -m flowq_analysis.analyze --xes <file> --out <dir>` writes `dfg.png` (frequency DFG), `performance.png` (performance DFG), `stage_waits.csv` (stage, mean, p90 minutes; stages = check_in→consult_start, lab_queue→lab_call, report_ready→return_queue), `deviations.csv` (activity counts for skip, rejoin, no_show, priority_set, return_queue), `variants.csv` (top 10 variants with counts).
- [ ] Step 1: Test `test_outputs_written` runs `main(['--xes', fixture, '--out', tmp])` and asserts the five files exist and `stage_waits.csv` has header `stage,mean_min,p90_min`.
- [ ] Step 2: `cd analysis && uv sync && uv run pytest` — FAIL.
- [ ] Step 3: Implement with `pm4py.read_xes`, `pm4py.discover_dfg`, `pm4py.save_vis_dfg`, `pm4py.discover_performance_dfg`, `pm4py.save_vis_performance_dfg`, pandas for stage waits.
- [ ] Step 4: `uv run pytest` — PASS; run on Task 10's 500-day output, figures open.
- [ ] Step 5: Stage and report.

---

## Plan 2 outline (written in full after Plan 1)

1. Migration: role `lab_staff` (users.role check, `get_user_role`, `proxy.ts` `/lab` prefix, dashboard redirect), `lab_lines`, `lab_test_types` (line_id, typical_min, must_first, turnaround_min), `lab_orders` (patient_id, ordering_doctor_id null, appointment_id null, external_prescriber text null, test_type_id, status `ordered|queued|collected|report_ready|delivered|cancelled`), `lab_queue_items` (patient × line × day, status, priority, timestamps), `lab_events` (same shape as `queue_events`), `dss_settings.report_review_min`, `appointments.visit_reason`. RLS: lab_staff manage lab rows; doctor/compounder create orders for own patients; patient reads own.
2. RPCs (`SECURITY DEFINER`, request key, advisory lock per line): `lab_order_tests`, `lab_enqueue` (now), `lab_register_outside`, `lab_call_next`, `lab_mark_collected`, `lab_skip/rejoin`, `lab_mark_report_ready`, `lab_line_session_start/pause/resume/end`, `dss_return_for_review`.
3. Snapshot RPC `lab_snapshot_input(line)` + mapper to `LineInput`.
4. UI: doctor queue console "Order tests" checklist; compounder post-consult "Lab now / Later"; `/lab/queue` console per line with suggestions (call next, routing next line); `/lab/register` outside patient; report-ready → compounder suggestion from `adviseReturn`; admin `/admin/lab-settings`.
5. DB tests mirroring `tests/dss/db/*` (access, idempotency, ordering), UI tests, Playwright walk-through; `npm run verify` green.
6. Exporter Task 11 extended to `lab_events`.
7. Push migrations to the linked project only after the owner says so.
