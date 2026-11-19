# Lab sample collection in the web app (Part 2 design)

Date: 2026-11-18. Owner: Nihad (solo). Parent design: `2026-11-17-hospital-flow-lab-design.md` (goals, decisions).
Library: `packages/flowq` (lab line estimates, routing, return advice) is already built and tested.

## 1. What changes for each person

| Person | New |
|---|---|
| Doctor | In the live queue, for the patient in the room: **Order tests** (tick test types). |
| Compounder | After a visit ends with tests ordered: **Lab now** or **Later**. When a report is ready: a suggestion **Report review today (expected HH:MM)** or **Book a later visit**, from `adviseReturn`. On yes, the patient re-enters the doctor's line as a report review. |
| Lab staff (`technician`) | `/lab/queue`: one line at a time (blood, urine, ECG, X-ray, ...). Open/pause/close the counter, call next, sample collected, skip/rejoin, undo own last action, routing suggestion "next line" for patients with more tests. `/lab/register`: queue a patient who comes later (pending orders by UHID / mobile) or an outside patient (paper prescription; tests ticked by staff). `/lab/reports`: mark reports ready. |
| Patient | Sees "In lab queue, line X, about N min" and "Report ready" notifications (same notification table as today). |
| Admin | `/admin/lab-settings`: lines and test types (typical minutes, must-go-first, turnaround minutes, active). |

## 2. Decisions

Owner-decided (2026-11-17/18): entry paths (doctor order + compounder now/later; outside patients at the counter; later patients
queued by lab staff); separate lines per test type, one counter each; routing suggested by the system and confirmed by staff;
report return same day or later depending on turnaround, doctor session and patient choice.

Claude's calls (correct me):
1. Lab staff use the existing role value **`technician`** (already in the live `user_role` enum), route prefix `/lab`. No enum change.
2. One **queue item per patient per line per day**; all of that patient's tests for that line ride on it.
3. Lab actions follow the DSS pattern exactly: `SECURITY DEFINER` RPCs `lab_*`, request keys (idempotent), one advisory lock per
   line per day, every action logged to **`lab_events`** (same shape as `queue_events`), own-last-action undo within
   `dss_settings.undo_window_sec`.
4. Line counters have sessions like doctors (`lab_line_sessions`: open / paused / closed). A line can be called past its closing
   time while people are still queued (same as the simulator).
5. Report review = walk-in appointment with new column `appointments.visit_reason` (`consult` | `report_review`), visit type
   `follow_up`, normal priority; `dss_settings.report_review_min` (default 4) feeds the engine.
6. Return advice is computed in the app (engine `adviseReturn` + doctor snapshot), shown as a compounder suggestion; nothing
   happens without a tap.
7. Lab patients are identified by UHID / name / mobile only on staff screens; no medical data beyond the test names.
8. Billing, report files and result values stay out of scope.

## 3. Data (new)

- `lab_lines(id, code unique, name, typical_min, active, sort_order)`
- `lab_test_types(id, code unique, name, line_id → lab_lines, must_first bool, turnaround_min int, active)`
- `lab_orders(id, patient_id, test_type_id, ordered_by uuid null, ordering_doctor_id uuid null, appointment_id uuid null,
  external_prescriber text null, order_date date, status ordered|queued|collected|report_ready|cancelled,
  queue_item_id uuid null, collected_at, report_ready_at, created_at)`
- `lab_queue_items(id, line_id, patient_id, queue_date, status queued|called|collected|skipped|cancelled, priority_level,
  queued_at, called_at, collected_at, skipped_at, rejoined_at, created_by)`; unique (line_id, patient_id, queue_date) while active.
- `lab_line_sessions(id, line_id, session_date, status open|paused|closed, opened_at, closed_at)` + `lab_line_pauses`.
- `lab_events(id, line_id, queue_item_id null, order_id null, patient_id null, event_type, actor_user_id, actor_role,
  occurred_at, request_key, metadata)` + unique (actor_user_id, request_key).
- `appointments.visit_reason text default 'consult'`; `dss_settings.report_review_min int default 4`.

RLS: lab tables readable by admin / technician / doctor / compounder; patients read only their own orders and queue items.
All writes go through RPCs (no direct table writes for authenticated users).

## 4. RPCs (all `lab_*` / `dss_*`, request key, logged)

`lab_order_tests(appointment_id, test_type_ids[], key)` (doctor of that appointment, or their compounder);
`lab_enqueue(order_ids[], line_id, key)` (compounder "Lab now", lab staff "queue later patient");
`lab_register_outside(patient_id, test_type_ids[], prescriber, key)`;
`lab_line_open / pause / resume / close(line_id, key)`; `lab_call_next(line_id, expected_current, key)`;
`lab_mark_collected(item_id, key)`; `lab_skip / lab_rejoin(item_id, key)`; `lab_undo(line_id, key)`;
`lab_mark_report_ready(order_id, key)`; `dss_return_for_review(appointment_id_of_first_visit, key)` (compounder; creates the
report-review walk-in); `lab_snapshot_input(line_id, date)` (engine input for one line).

## 5. Screens

Reuse the queue console building blocks (`useLiveSnapshot`, `ConfirmDialog`, toasts, request keys). New: `LabConsole`
(line picker, counter banner, now serving, waiting list with skip/rejoin, suggestions incl. routing), `OrderTestsPanel`
(doctor), `LabNowLaterBar` and `ReturnAdviceCard` (compounder), `/lab/register`, `/lab/reports`, `/admin/lab-settings`.

## 6. Verification

- DB tests against the **local** Supabase (Docker; `supabase start` builds from migrations): access (who may call what),
  idempotency, ordering, undo, concurrency (two "Call next"), report-review creation, RLS for patients.
- Unit tests: snapshot mapper, routing / return suggestions on the server.
- UI tests (jsdom) for the new components; a Playwright walk-through on the local stack.
- `npm run verify` green (DB tests on local).

## 7. Anti-goals

No migration is pushed to the online Supabase without the owner's explicit go-ahead. The doctor queue's DSS rules and tests
must stay green. No real patient data in tests.

## 8. Risks

- The online database differs from the migration files (role enum, no `prescriptions` table). The migration must work on both:
  it never depends on `prescriptions`, and treats `users.role` as the enum (`technician` exists in both).
- One pre-existing DSS DB test ("Module 4 check-in and undo") fails locally on a duplicate slot in its own setup; not caused by
  this work; left as is and reported.
