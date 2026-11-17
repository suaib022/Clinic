# Hospital patient flow: doctor queue + lab sample collection (design)

Date: 2026-11-17. Owner: Nihad (solo). Status: approved by the owner to proceed ("make the plan, then start").

## 1. Intent

Turn the Clinic queue decision-support system into a SoftwareX paper. The paper's software is a reusable
patient-flow library (engine + simulator + event-log export) with the Clinic web app as its reference
deployment. The web app gains a second service point, lab sample collection, so the software models a real
multi-stage journey: doctor, then lab, then (sometimes) back to the doctor with the report.

Why: the supervisor asked for options that maximise acceptance and fit the current app, and for at least three
implemented items before the next meeting. A doctor-only queue reads as "one app's feature"; doctor + lab +
return loop is a general outpatient-flow tool and gives process mining a real journey to analyse.

## 2. Goals

1. Lab sample collection in the web app:
   - Any hospital doctor orders tests for a patient during or after the consult.
   - After the patient leaves the room, the compounder asks "now or later". "Now" puts the patient in the lab
     queue; "later" leaves the order pending, and lab staff queue it when the patient comes back.
   - Outside patients (paper prescription from another doctor) are registered at the lab counter by lab staff.
   - Separate lines per test type (for example blood, urine/stool, X-ray, ECG, ultrasound). Admin configures
     the lines and test types. One counter per line.
   - A patient with tests in several lines gets a suggested order: tests marked "must go first" (fasting)
     first, then the line with the shortest expected wait. Lab staff confirm.
   - Lab staff mark sample collected, and later report ready.
   - When a report is ready, the system advises the ordering doctor's compounder: same-day report review if the
     doctor's session today is still running with enough time left, otherwise a follow-up booking. The patient
     decides. A same-day review re-enters the doctor queue as a short "report review" visit.
2. A reusable library (`packages/flowq`), pure TypeScript, no Supabase or Next:
   - the existing queue engine, generalised so one engine serves a doctor queue and a lab line;
   - routing advice (which lab line next) and return advice (same-day review or booking);
   - a seeded stochastic discrete-event simulator for a hospital day (many doctors, lab lines, walk-ins,
     no-shows, lateness, pauses, emergencies, report turnaround, same-day returns);
   - baselines and a benchmark harness (ETA error, range coverage, waits, idle time, journey time);
   - an event-log exporter to OCEL 2.0 (JSON) and XES, fed by the simulator and by the web app's database.
3. A process-mining analysis pipeline (Python, PM4Py) over the exported logs: process map, waits per stage,
   bottlenecks, deviations (skip, rejoin, undo, no-show, priority jump, overrun, lab "later" orders).
4. Paper-ready outputs: benchmark tables and figures, a clean public repository for the library.

## 3. Non-goals

- Billing, payment or pricing for lab tests.
- Lab result values, report files or report upload (the existing `lab_results` extraction stays as is).
- Imaging scheduling with appointments; X-ray/ultrasound are plain walk-in lines here.
- More than one counter per line (multi-server) in this round.
- Pharmacy, billing counters, inpatient anything.
- Real patient data collection. All evidence is simulation-based; real logs are a bonus.

## 4. Anti-goals (would make this a failure even if it works)

- Breaking the existing doctor queue, its tests or its RLS rules.
- Applying database migrations to the linked Supabase project without the owner's explicit go-ahead.
- Shipping secrets, `pass.md`, `test-patients.md`, scraped hospital data or real patient data in the public
  paper repository.
- A paper claim that the benchmark cannot back (for example "accurate ETAs" without baselines and coverage).

## 5. Constraints

- Stack: Next.js 16 (read `node_modules/next/dist/docs/` before Next code), React 19, TypeScript, Supabase
  Postgres with RLS and `SECURITY DEFINER` RPCs, Vitest, `npm run verify`.
- Database is a linked remote Supabase project (no local stack). Migrations are files first; pushing them is a
  separate, confirmed step. DB tests use the dev-only seed accounts (`DSS_DEV_SEED=1`).
- Time zone: Asia/Dhaka (UTC+6, no DST). Engine works in epoch ms.
- Existing roles: `admin`, `doctor`, `compounder`, `patient`; `proxy.ts` maps role to route prefix.
- Solo developer. Python 3.13 and `uv` are available for the analysis part.
- The Clinic repo is public on GitHub and tracks files that may hold credentials. The paper library must be
  published from a fresh repository.

## 6. Approaches considered

1. **Grow the engine in place** (`lib/queue/engine`), add lab code next to it, extract a library at the end.
   Fastest to start. Extraction at the end is a big risky move, and nothing forces the code to stay app-free.
2. **Workspace package inside the Clinic repo** (`packages/flowq`, npm workspaces). Move the engine there;
   Clinic imports it; simulator, benchmark and exporter live in the package. At publish time the folder is
   copied (with `git subtree split` or a fresh copy) into a new public repo. Keeps one dev loop and enforces
   the "no app code" boundary from day one.
3. **Separate repository from day one**, Clinic consumes it via npm/git dependency. Cleanest for the paper, but
   two repos, version bumps and linking slow a solo developer.

**Chosen: 2** (owner handed the how to Claude). `lib/queue/engine/index.ts` stays as a thin re-export so
existing imports keep working.

## 7. Design decisions (owner-decided)

- Entry paths to the lab queue: doctor order + compounder "now/later"; outside patients via lab staff.
- Lines per test type (option b), configurable.
- Multi-line routing: system suggests, lab staff confirm.
- Report return: same-day review or later booking, depending on turnaround, doctor availability and session
  time left, and the patient's choice.

## 8. Design decisions (Claude's calls, open to correction)

- New role `lab_staff`, route prefix `/lab`, login via `/login`.
- Each lab line is an engine "service point" with its own session (open/paused/closed), FIFO by counted time
  with priority 0/1/2, no booked times (every entry behaves like a walk-in). Durations per test type come from
  history, else the admin-set typical minutes.
- "Must go first" flag on a test type (fasting); routing puts those first, then shortest expected wait.
- Report review re-enters the doctor queue as a walk-in with `visit_reason = 'report_review'` (visit type stays
  `follow_up`), normal priority, counted from re-entry, duration from setting `report_review_min` (default 4).
- Return advice: same-day if `report_ready_at + travel buffer (10 min) + queue estimate <= session end - 10
  min`; otherwise suggest the next schedule day.
- Lab events go to a new `lab_events` table with the same shape as `queue_events` (case, activity, time,
  actor, role, metadata, request key). The exporter merges both.
- OCEL object types: `patient`, `appointment`, `lab_order`, `lab_queue_item`, `doctor`, `doctor_session`,
  `lab_line`. XES case = patient-day journey.
- Simulator: seeded RNG (mulberry32), discrete-event loop, engine called at each decision point, parameters
  from a JSON scenario file with values cited from published outpatient studies.
- Baselines for ETA: booked slot time; position x slot length; running mean of today's visits. Baselines for
  routing: fixed order (blood first), random, patient's choice (shortest physical line).
- Metrics: ETA MAE and median absolute error, range coverage (share of real starts within low/high), mean and
  p90 wait per stage, line idle share, journey time, same-day return rate.

## 9. Left to the builder

Exact table columns, RPC signatures, UI layout details, scenario parameter values (with citations), figure
styling, test fixtures.

## 10. Risks

- Scope for one person is large; the plan orders work so library + simulator + export + analysis (no DB
  risk) land first.
- Role addition touches `users.role` checks, `proxy.ts` and dashboards; covered by DB tests.
- Reviewers may question simulator realism; parameters are cited and a sensitivity analysis is included.
