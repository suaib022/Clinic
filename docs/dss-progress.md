# DSS progress

Branch `feature/dss`. Status values: **done / partial / blocked**. "DB test" = Vitest suite run against the linked Supabase project with dev-only test accounts (`DSS_DEV_SEED=1`).

| ID | Requirement | Status | Files | Verified by |
|---|---|---|---|---|
| DSS-01 | Read existing queue code, tables, triggers, RLS, slot length | done | docs/dss-audit.md | Live DB introspection (`scripts/dss/db.mjs`) |
| DSS-02 | Audit doc | done | docs/dss-audit.md | Review |
| DSS-03 | List Module 4 actions to wrap | done | docs/dss-audit.md §1 | Review |
| DSS-04 | Branch + task list | done | `feature/dss` | `git branch` |
| DSS-10 | Appointment times, priority_level, visit_type, stricter status trigger | done | migrations/20261110000000 | DB test "blocks impossible status changes, even for admin" |
| DSS-11 | Session states + pauses table | done | same | DB test "pause and resume…" (states map: no row = not_started, `open` = active) |
| DSS-12 | queue_events records all DSS events with actor, role, appointment, doctor, JSON, time | done | same | DB test "check-in is idempotent … logged once" |
| DSS-13 | dss_settings with B1 defaults, staff read / admin write | done | same | RLS policy + M7 settings test |
| DSS-14 | Indexes for doctor+day queries | done | same | `idx_appointments_doctor_date_serial`, `idx_cal_doctor_type_ended` |
| DSS-15 | Check in | done | `dss_check_in` | DB test |
| DSS-16 | Call next (B3 order, queue empty) | done | `dss_call_next` | DB tests (order, emergency, skip, concurrency) |
| DSS-17 | End consultation | done | `dss_end_consult` | DB test via undo path + sim day |
| DSS-18 | Mark no-show | done | `dss_mark_no_show` (+ `mark_no_show` uses grace_min) | DB test "refused inside grace…" |
| DSS-19 | Set priority | done | `dss_set_priority` | DB test "emergency goes next" |
| DSS-20 | Skip / rejoin | done | `dss_skip`, `dss_rejoin` | DB test |
| DSS-21 | Pause / resume | done | `dss_session_pause/resume` | DB test |
| DSS-22 | Undo own last action within window | done | `dss_undo` | DB test "undo: only your own last action" |
| DSS-23 | Every function checks caller (reuses assignment check) | done | `_dss_require`, `dss_can_manage`, `compounder_doctor_id` | DB tests (patient, logged-out, other compounder refused) |
| DSS-24 | Access + concurrency tests | done | tests/dss/db/queue-actions.test.ts | 15/15 pass, run 3× for race stability |

## Decisions (made without asking, per Process rule 7)
1. **Session state names**: DB keeps `open/paused/ended` (Module 4 UI depends on it). The engine maps `open` to `active` and "no row today" to `not_started`.
2. **Legacy 6-hour timestamp bug**: fixed by pinning `TimeZone=Asia/Dhaka` on the queue lifecycle RPCs (`ALTER FUNCTION … SET timezone`). Payment, refund and rebook functions are deliberately not touched. Old rows are **not rewritten**; history uses durations (end − start), which were always correct.
3. **`queue_events.appointment_id` is now nullable**, and a BEFORE INSERT trigger nulls ids that don't exist. This fixes `start_doctor_session` and `record_doctor_delay`, which always failed on the FK.
4. **Dropped `start_doctor_session(uuid)`** (1-arg overload): it made every `rpc('start_doctor_session', {p_doctor_id})` ambiguous. The 4-arg version (defaults) handles the same call.
5. **Multi-doctor compounders**: new `compounder_doctors` table, kept in sync with `compounders.assigned_doctor_id` by trigger. Extra doctors are added by inserting rows (admin RLS). `compounder_doctor_id()` returns the doctor chosen in the current DSS call, so the wrapped Module 4 functions accept it.
6. **Call next on a not-started day** starts the session implicitly (logged as `session_start`), so the compounder is never blocked. Lateness is measured from the schedule window.
7. **Ending a session with a patient in the room is refused** ("tap Done first") rather than auto-finishing that visit.
8. **Canonical events**: each DSS action writes one `queue_events` row with the plan's event names (`check_in`, `call_next`, …), carrying `request_key` and the result. The wrapped Module 4 function still writes its legacy row (`checked_in`, `consultation_started`, …). Reports read appointment timestamps, not event counts.
9. **Direct writes closed**: a trigger rejects changes to queue columns from `authenticated`/`anon` unless the caller is admin (keeps `/admin/appointments` working). Previously a patient could set their own appointment to `checked_in` via the REST API.
10. **Completed visits can never go back to waiting**, admin included. Reverse moves (`in_consultation→checked_in`, `prescription_pending→in_consultation`, `no_show→checked_in`) are only allowed inside `dss_undo`.
11. **Lint**: the repo has 220 pre-existing ESLint errors. `verify-dss` lints the DSS files with `--max-warnings=0`, and the rest is left as is.
12. **`test:m1`** pointed at a missing file and was removed. `npm test` and `npm run test:dss` were added.

## M2: engine (`lib/queue/engine/`, pure TypeScript)

| ID | Requirement | Status | Files | Verified by |
|---|---|---|---|---|
| DSS-30 | computeQueueOrder (B2, B3) | done | engine/order.ts | tests "queue order" (late arrival lands between 5 and 6, grace, emergency, skip, rejoin) |
| DSS-31 | computeExpectedDurations (B4) | done | engine/durations.ts | tests "durations" (median/quartiles 9/6/13, dept → slot fallback, clamp, last 30, outlier) |
| DSS-32 | computeEstimates (B5, B6) with range, ahead, confidence, label, flags, reason | done | engine/estimates.ts | B5 worked example: **7:02 PM, 6:53–7:14, Running late, wait 15–35**; label edges 5/15 |
| DSS-33 | computeSuggestions (B8) with id, type, severity, message, action, key | done | engine/suggestions.ts | tests "suggestions" (all 8 situations, dismissals, stable keys, urgent first) |
| DSS-34 | Old calculateQueueEstimate → deprecated wrapper over the engine | done (M3) | lib/queue/decisionSupport.ts | M3 tests |
| DSS-35 | Vitest suite | done | tests/dss/engine/engine.test.ts | 37/37 pass |
| DSS-36 | Simulator | done | scripts/dss-simulate.ts (`npm run dss:simulate`) | runs in verify; fails if mean error > 15 min |

Engine decisions:
- Median and quartiles use linear interpolation (p = 0.25 / 0.5 / 0.75). Only durations of 1–120 min feed history (the DB has sub-minute test rows).
- Without enough history there is no spread, so short/long = typical × 0.7 / × 1.4 (then clamped).
- The department average is used only when the doctor's speciality has a benchmark row. The generic `DEFAULT` row is **not** used, so the rule "then the slot length" can actually happen.
- Not-arrived patients get a hypothetical "if you check in now" start (for "please arrive by"), labelled *Not arrived* and with low confidence. They are never counted for others.
- While **paused**, estimates assume the doctor resumes now and say "Doctor is on a short break". On resume they are recalculated, because the pause is subtracted from the visit in progress.
- "Doctor delay" = expected start minus booked time of the first on-time patient in line (or the lateness of the visit in the room, or the minutes past the session start if not started).

## M3: one safe source of queue data

| ID | Requirement | Status | Files | Verified by |
|---|---|---|---|---|
| DSS-40 | `getQueueSnapshot(doctorId, date)` gathering appointments, session + pauses, history, slot, benchmark, settings | done | `dss_snapshot_input` RPC, lib/queue/server.ts, lib/queue/snapshotInput.ts | mapper unit tests; HTTP test "compounders only for assigned doctors" |
| DSS-41 | `GET /api/queue/snapshot` for staff | done | app/api/queue/snapshot/route.ts | HTTP tests (401/403/200, admin any doctor, doctor own only) |
| DSS-42 | `GET /api/queue/my-status` for patients (self + family) | done | app/api/queue/my-status/route.ts | HTTP tests: exact key whitelist, family member visible to owner, other patient 404 |
| DSS-43 | Close the public `/api/queue/estimate` | done | app/api/queue/estimate/route.ts, lib/queue/decisionSupport.ts (deprecated wrapper) | HTTP test: logged-out 401 on GET and POST; patient UHID lookup 400; other doctor 404 |
| DSS-44 | Rate limits + zod validation | done | lib/queue/rateLimit.ts | unit test; HTTP "validates input" |
| DSS-45 | Tests: 401, cross-patient, unassigned compounder, no names/UHIDs leak | done | tests/dss/api/endpoints.test.ts | 7/7 pass against `next start` (run by verify) |

M3 decisions:
- **The public booking page does not need the estimate endpoint** (only the patient card called it), so it now requires login and nothing is exposed anonymously.
- The patient endpoint checks ownership through the patient's own session first. Only then does it read the doctor's day with the service role (the RPC strips names and UHIDs for that caller), and only that patient's numbers leave the server. The snapshot RPC itself is **not** callable by patients, so they cannot pull other patients' serials or times from the REST API.
- The rate limiter is per server instance (in memory), documented with a `shortcut:` comment.

## M4: notifications for every role

| ID | Requirement | Status | Files | Verified by |
|---|---|---|---|---|
| DSS-50 | Single `notifications` table (user, patient, type, title, body, link, dedupe key, read time); old data kept; own-only read/mark | done | migrations/20261110010000, …010100 | DB tests "users read only their own", "mark their own as read, and nothing else" (cannot edit body, cannot insert) |
| DSS-51 | `notify()` with dedupe key | done | `_dss_notify`, `_dss_notify_patient`, `_dss_notify_compounders`, `_dss_notify_waiting` | DB tests (double tap → 1, repeated syncs → 1) |
| DSS-52 | Bell with unread count + dropdown on all dashboards; full page with mark read / mark all; Realtime with 20 s fallback | done | components/notifications/*, components/DashboardSidebar.tsx, components/HeaderAuthLinks.tsx, app/notifications | Browser check (patient1): live insert shows without reload, badge updates, mark-all clears both bells |
| DSS-53 | All B10 notifications, each exactly once | done | `dss_queue_event_notify` trigger + `dss_sync_estimates` | tests/dss/db/notifications.test.ts 13/13 |
| DSS-54 | Short, plain, no medical data | done | message templates in SQL | DB test scans every generated text for medical words |

M4 decisions and findings:
- **Dashboards had no header** (each page renders only `DashboardSidebar`, hidden on phones). The bell lives in `DashboardSidebar`: a fixed top-right bell on desktop, plus a new phone top bar with a menu (phones previously had no dashboard navigation at all). Public pages get the bell in `HeaderAuthLinks`.
- **Realtime fix**: channels must join with the user's token, or RLS hides every event. `lib/realtime.ts` sets it before subscribing and polls whenever the channel is down.
- **Bug found by test**: broadcasts deduplicated per event *and account*, so a family account received one notice for two booked members. They are now deduplicated per appointment, still once per event.
- "Near turn", "you're next", "time moved 10+ min" and "label changed" are decided **in the database** (`dss_sync_estimates`), from the engine numbers that staff screens send after each load. It remembers the last time it told the patient, so reloads never repeat a notice. Estimate notifications therefore need a staff screen (compounder or doctor queue page) to be open, as it is during a clinic day. Action notifications (check-in, called, no-show, pause, delay) come from the action itself.
- The old `patient_notifications` policy let **any doctor or compounder write any patient's notifications**. It is now admin-only, and existing rows are copied and new ones mirrored into `notifications`.
- Dev-only quick login `/api/dev/login-as?as=<account>` exists only with `DSS_DEV_SEED=1`, a `DSS_TEST_PASSWORD`, and a request to localhost.

## M5: compounder live queue (`/compounder/queue`)

| ID | Requirement | Status | Files | Verified by |
|---|---|---|---|---|
| DSS-60 | Doctor switcher for multi-doctor compounders | done | app/compounder/queue/page.tsx, QueueConsole | `listManagedDoctors` + `?doctor=` (validated against assignments) |
| DSS-61 | Now serving: serial, name, new/follow-up, timer, expected, overrun; big Done / Call next | done | console/Panels.tsx | UI tests "active session"; browser |
| DSS-62 | Next 3 with arrived/not and call button | done | console/QueueLists.tsx `NextUp` | browser |
| DSS-63 | Waiting list with booked vs expected, arrived, priority, label, source; row actions | done | `WaitingList` | browser; UI test "no-show asks for confirmation" |
| DSS-64 | Suggestions with confirm + dismiss (remembered for the day) | done | `SuggestionsPanel`, `dss_dismiss_suggestion` | UI test "confirming a suggestion" |
| DSS-65 | Walk-in via Module 4 lookup, impact shown first | done | console/WalkInPanel.tsx, `walkInImpact` | browser |
| DSS-66 | Day summary bar | done | `DaySummary` | browser |
| DSS-67 | Session banner + Pause/Resume + "Notify all waiting" preview with count | done | `SessionBanner`, confirm dialog | browser |
| DSS-68 | Realtime on appointments/events/sessions, debounced; 10 s fallback; Live/Reconnecting | done | console/useLiveSnapshot.ts, lib/realtime.ts | browser: a second compounder's check-in appeared within 3 s |
| DSS-69 | Confirm no-show, 2-min Undo bar, buttons disabled while working, "Already updated by someone else", server wins | done | QueueConsole | UI tests "double tap", "collision" |
| DSS-70 | Nothing medical | done | — | UI test scans the screen's sources for medical tables/words |
| DSS-71 | Component tests | done | tests/dss/ui/queue-console.test.tsx | 18/18 |
| DSS-72 | Sidebar link; proxy | done | DashboardSidebar | `/compounder/*` already protected by `proxy.ts` |

Notes: the site theme forces every `.btn` teal with `!important`. Secondary and dangerous actions use scoped `.btn.dss-outline` / `.dss-solid-danger` classes (app/globals.css). Dialogs sit above the site's floating chat widget.
Dev helper: `npx tsx scripts/dss/demo-day.ts` sets up a realistic day for test doctor A.

## M6: patient live queue

| ID | Requirement | Status | Files | Verified by |
|---|---|---|---|---|
| DSS-80 | Live panel: my serial, now serving, ahead, wait range (rough-estimate note), booked vs expected, label | done | components/queue/PatientLiveQueueCard.tsx | browser (patient1 on demo day) |
| DSS-81 | One-line reason from engine flags | done | engine `reasonText` | engine tests + browser ("Doctor hasn't started yet") |
| DSS-82 | Stages: before check-in / waiting / called / done / no-show-cancelled with rebook | done | same | browser, my-status `stage` |
| DSS-83 | One panel per booked family member, labelled | done | app/patient/dashboard/page.tsx | browser: two panels (Patient One, Family Member) |
| DSS-84 | Realtime (own appointment + own notifications) + 15 s fallback, last-updated, no flicker | done | same | keeps last data while reloading |
| DSS-85 | Only `/api/queue/my-status`; test response and page | done | tests/dss/api/endpoints.test.ts | key whitelist + page HTML scan for other patients' names/UHIDs |
| DSS-86 | Small phones + screen readers | done | `aria-live`, `dl/dt/dd`, 2-column grid on phones | browser |

## M7: doctor screen, admin settings, board, reports

| ID | Requirement | Status | Files | Verified by |
|---|---|---|---|---|
| DSS-90 | `/doctor/queue`: now serving, remaining, delay, Start / Pause / Resume / End; ending leaves "resolve remaining" for the compounder | done | app/doctor/queue/page.tsx (QueueConsole `mode="doctor"`, read-only list, no walk-in/suggestions) | DB tests (doctor pause/resume); sidebar link |
| DSS-91 | Doctor can Call next and Done (same functions, same checks) | done | lib/queue/actions.ts → dss_call_next / dss_end_consult | `dss_can_manage` allows the doctor for their own id only (DB test "doctor A own snapshot only") |
| DSS-92 | Admin settings page (validated, change log) + read-only live clinic board | done | app/admin/queue-settings, app/admin/queue-board, `dss_update_settings` | tests/dss/db/admin.test.ts; browser |
| DSS-93 | Reports by doctor / department / date range | done | `dss_report`, app/admin/queue-reports | admin test; browser (real doctors listed) |
| DSS-94 | End-of-day cleanup without a scheduled job | done | engine suggestions + `dss_session_end` / `dss_resolve_remaining` | engine tests ("resolve remaining"), DB tests |
| DSS-95 | Every finished visit logged; backfill old visits | done | `_dss_fix_duration`, migration 20261110030000 backfill | admin test: zero finished visits without a log row (65 logs after backfill) |

**DSS-94 choice:** no cron. No-show candidates are recalculated every time any queue screen loads (B8 skip / no-show suggestions). Ending the session reports the unresolved count, notifies compounders, and the urgent "Resolve remaining patients" suggestion marks them all as no-show (with a rebook link) in one confirmed tap. Nobody is dropped silently.
