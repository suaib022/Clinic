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
