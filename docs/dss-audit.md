# DSS Audit (DSS-M0)

Audit of the live queue code and the **live database** (read via `scripts/dss/db.mjs`, not just the migration files, which have drifted), done 2026-11-09 on `main` @ 76d27dc.

## 1. What exists today

### Tables (live columns)

| Table | Relevant columns | Notes |
|---|---|---|
| `appointments` | `status`, `serial_no`, `appointment_date`, `start_time`, `scheduled_start` (timestamptz, correct UTC for online bookings), `slot_minutes`, `visit_type` (new/follow_up), `is_priority`, `priority_reason`, `checked_in_at`, `consult_started_at`, `consult_ended_at`, `no_show_marked_at`, `status_changed_at/by`, `visit_source` (online/walk_in), `created_by_user_id` | Statuses live: `hold, scheduled, checked_in, in_consultation, prescription_pending, completed, cancelled, no_show` (**`prescription_pending` exists** and is not in the plan's list). No `called_at`, no `priority_level`, no skip/rejoin. |
| `doctor_sessions` | `status` (`open/paused/ended`), `started_at`, `ended_at`, `scheduled_start` (time), `delay_minutes`, `delay_reason`, `delay_notified_at`, `started_by_user_id` | "Not started" = no row for the day. Unique open session per doctor per day. |
| `doctor_session_pauses` | `session_id, paused_at, resumed_at, reason` | Already exists (DSS-11 table is done). |
| `queue_events` | `appointment_id` (**NOT NULL + FK**), `doctor_id`, `event_type`, `from/to_status`, `actor_user_id`, `actor_role`, `occurred_at`, `metadata` | Append-only (update/delete trigger). No request key. |
| `department_benchmarks` | `speciality_name`, `avg/min/max_consult_minutes`, … | Readable by `public` (anon). Harmless reference data. |
| `consultation_analytics_logs` | per finished visit: `consult_duration_minutes`, `visit_type`, `predicted_*` … | Written by `end_consultation` / `complete_consultation`. 10 rows, mostly test data with sub-minute durations. |
| `patient_notifications` | `patient_id, appointment_id, type, title, message, is_read, action_url` | 4 rows (`doctor_cancellation`), written by `doctor_cancel_schedule`. No UI reads it. |
| `compounders` | `id`, `assigned_doctor_id` (single doctor) | Plan says "one or more doctors": needs a mapping table. |
| `doctor_schedules` | `day_of_week, start_time, end_time, slot_duration_minutes` (default **10**), `is_active` | This is where the real slot length lives. Appointment rows also carry `slot_minutes`. |
| `dss_settings`, `notifications`, `compounder_doctors` | — | **Missing.** |

### Functions reused (Module 4 and Module 1, all SECURITY DEFINER)
`check_in_appointment`, `undo_check_in`, `mark_no_show`, `set_priority`, `retract_walk_in`, `create_walk_in_appointment`, `lookup_patient_for_walk_in`, `start_consultation`, `end_consultation` (→ `prescription_pending` + analytics log), `complete_consultation`, `complete_prescription_upload`, `start_doctor_session` (2 overloads), `pause_doctor_session`, `resume_doctor_session`, `end_doctor_session`, `record_doctor_delay`, `cancel_appointment`, `admin_reopen_no_show`. Permission helper: `compounder_doctor_id(uuid)`, `get_user_role()`, `is_patient_owner(uuid)`.

### DSS-03: Module 4 compounder actions (server actions in `app/compounder/actions.ts`)
| Action | RPC | Wrapped by |
|---|---|---|
| Check-in | `check_in_appointment` | `dss_check_in` |
| Undo check-in | `undo_check_in` | `dss_undo` (generic) |
| No-show | `mark_no_show` | `dss_mark_no_show` |
| Priority | `set_priority` | `dss_set_priority` |
| Walk-in lookup / register | `lookup_patient_for_walk_in`, `registerNewPatient` | reused as-is |
| Walk-in create | `create_walk_in_appointment` | `dss_walk_in` |
| Walk-in retract | `retract_walk_in` | `dss_undo` of a walk-in, plus the existing button |
| Start/End consult | `start_consultation`, `end_consultation` | `dss_call_next`, `dss_end_consult` |
| Session start/pause/resume/end | `start_doctor_session`, … | `dss_session_*` |

### App code
* `lib/queue/decisionSupport.ts` `calculateQueueEstimate`: the old estimator.
* `app/api/queue/estimate` (GET+POST): **public, no auth, uses `supabaseAdmin`**. Anyone can look up any patient's name, UHID, serial and doctor by UHID or by serial+doctor id. **This is the security hole.**
* `components/queue/PatientLiveQueueCard.tsx`: patient card polling the public endpoint every 20 s; shows the full `QueueEstimate`, including `currentlyServingPatientName` (**another patient's name shown to a patient**).
* Compounder portal: `/compounder/dashboard`, `/compounder/bookings` (BookingsClient, 900 lines), `/compounder/walk-in`, `/compounder/upload`. There are no layout files; each page renders `DashboardSidebar`.
* Doctor: `/doctor/appointments` (DoctorTodayAppointmentsClient), `/api/doctor/session/[action]`.
* Header: `HeaderAuthLinks` is rendered on every page when logged in, so the bell goes there.
* `proxy.ts` protects `/admin`, `/doctor`, `/compounder`, `/patient` by role prefix. New pages under those prefixes are covered automatically.
* No Vitest. `npm run verify` runs `scripts/verify-m4.ts` (a read-only smoke check). `test:m1` points to a missing `scripts/m1-tests.ts`.
* Baseline: `tsc` is clean and `next build` is OK. `eslint` reports **220 pre-existing errors**, so verify lints only the DSS files.

## 2. Problems found

### Old estimate logic (`calculateQueueEstimate`)
1. Counts patients ahead **by serial number**, not by arrival or priority, so late arrivals and emergencies are ignored.
2. Counts **not-arrived** patients at 80% weight (B2 says exclude them).
3. Duration = 60/40 blend of today's average and the benchmark. No doctor history, no median, no visit type, no clamp to 3–60, and pause time is not subtracted.
4. Hard-coded 5-minute "chamber will start" guess and 90 s transition. Falls back to `09:00`.
5. Time-zone bug: builds `new Date(y,m,d,h,mm)` in server local time, then mixes it with `toZonedTime` output, so it is wrong on a UTC server (Netlify).
6. Gives a single number, not a range: no confidence and no early/on-time/late label.
7. Uses `supabaseAdmin` for everything and returns other patients' names.

### Database bugs found
1. **Timestamps stored 6 h off.** The RPCs write `CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka'` (a Dhaka wall-clock `timestamp`) into `timestamptz` columns. The DB session time zone is UTC, so the value is stored as if Dhaka wall time were UTC (+6 h). Verified on live rows: walk-in created `06:20Z`, consult_started `12:21Z`. **Differences between two such stamps are still correct**, so historical durations are valid, but absolute times are not. Fix: all new and re-created functions use `now()`. Old rows are not rewritten (no data destruction), and history uses durations only.
2. `start_doctor_session(4 args)` and `record_doctor_delay` insert `gen_random_uuid()` as `queue_events.appointment_id`, which **violates the FK**, so these calls always fail (no `chamber_started` events exist in the DB). Fix: make `queue_events.appointment_id` nullable and pass NULL for session events.
3. The live `enforce_status_transition` (from the later "admin bypass" migration) **dropped `checked_in → scheduled`**, so `undo_check_in` is broken for compounders. Admin bypasses every rule, so even `completed → scheduled` is possible.
4. `authenticated` has column UPDATE on `appointments.status` and the timestamps, and RLS lets **patients update their own appointment rows**. A patient can set their own status to `checked_in` via PostgREST, bypassing every RPC. Fix: a guard trigger that rejects direct changes to queue columns from `authenticated`/`anon` (admin's direct status edit in `/admin/appointments` keeps working).
5. `patient_notifications` policy "Staff and admin full access" gives **compounders and doctors write access to every patient's notifications**. Superseded by the new `notifications` table with own-row-only RLS.
6. `create_walk_in_appointment` hard-codes `+ interval '15 minutes'` and stores a shifted `scheduled_start`.
7. Compounders can SELECT all appointments (not just their doctor's). Not changed, since Module 4 pages depend on it, but every DSS read is filtered by `dss_can_manage(doctor)` inside SECURITY DEFINER functions.
8. Realtime publication `supabase_realtime` has **no tables**.

## 3. Database changes (exact list)

Migration `20261110000000_dss_m1_queue_schema.sql` (idempotent, additive):
* `appointments` + `called_at timestamptz`, `priority_level smallint not null default 0 check (0..2)` (backfilled 1 where `is_priority`), `skipped_at timestamptz`, `rejoined_at timestamptz`. Columns that already exist (`checked_in_at`, `consult_started_at`, `consult_ended_at`, `visit_type`) are reused.
* `queue_events` + `request_key text`, `session_id uuid`. `appointment_id` becomes nullable. Unique `(actor_user_id, request_key)`. Index `(doctor_id, occurred_at desc)` exists; add `(appointment_id, occurred_at)`.
* `doctor_sessions`: keep the status values `open/paused/ended` (the app maps `open` to "active" and no row to "not_started"; renaming would break Module 4 UI). Add `scheduled_end time`, `slot_minutes int`.
* New `compounder_doctors(compounder_id, doctor_id)`, backfilled from `compounders.assigned_doctor_id`.
* New `dss_settings` (single row, B1 defaults) and `dss_settings_log`.
* New `dss_appointment_tracking(appointment_id pk, first_eta, checkin_eta, last_eta, last_label, last_notified_eta, updated_at)`: estimate memory for "moved 10+ min", the "wait grew" suggestion and the accuracy report.
* New `dss_suggestion_dismissals(doctor_id, day, suggestion_key, user_id)`.
* Indexes: `appointments(doctor_id, appointment_date, serial_no)`, `consultation_analytics_logs(doctor_id, visit_type, consult_ended_at desc)`.
* Triggers: rewrite `enforce_status_transition` (adds undo transitions only inside `dss_undo`; terminal states final even for admin, except the admin `no_show → scheduled` reopen) and add `dss_guard_queue_columns`.
* Functions: `dss_can_manage`, `dss_counted_time`, the actions `dss_check_in`, `dss_call_next`, `dss_end_consult`, `dss_mark_no_show`, `dss_set_priority`, `dss_skip`, `dss_rejoin`, `dss_walk_in`, `dss_session_start|pause|resume|end`, `dss_broadcast_delay`, `dss_undo`, and the read `dss_snapshot_input`.
* Re-created Module 4/1 functions (same signatures): `now()` instead of shifted time, `dss_can_manage` instead of the single-doctor check, NULL appointment id for session events, and pause-aware duration in the analytics log.

Migration `…_dss_m4_notifications.sql`: `notifications` table, copy of `patient_notifications`, mirror trigger, `dss_notify` (internal), `dss_sync_estimates`, and realtime publication.

Migration `…_dss_m7_admin.sql`: `dss_update_settings` with change log, report RPCs, and the analytics backfill.

## 4. Reuse vs new
Reused: every Module 4 RPC (wrapped), `doctor_session_pauses`, `consultation_analytics_logs`, `department_benchmarks`, `doctor_schedules.slot_duration_minutes`, `DashboardSidebar`, `requireRole`, `lib/format`, the walk-in UI flow and the Bootstrap styling.
New: the engine (`lib/queue/engine`), the snapshot service, two API routes, the bell, `/compounder/queue`, `/doctor/queue`, `/admin/queue-settings`, `/admin/queue-board` and `/admin/queue-reports`.
