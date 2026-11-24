# Demo guide

A 10 to 12 minute walkthrough that follows one patient through the clinic, then shows the engine behind it.
Use demo accounts and fake patients only. Credentials are never kept in this repository: the presenter keeps them in a private note.

## Before you present (30 minutes earlier)
- [ ] Open the site once (cold start) and log in as each role you will use; leave tabs open.
- [ ] Demo data exists for today: one doctor with a session, 6 to 10 booked patients with 10-minute slots, a few past visits for history.
      (Dev-only helpers: `npm run dss:seed` creates the DSS test accounts; `scripts/dss/demo-day.ts` sets up a clinic day. Both write to the database
      named in `.env.local` and need `DSS_DEV_SEED=1` on the presenter's own machine only; never set that on a public site.)
- [ ] Third-party credit: OpenRouter (lab report vision), ElevenLabs (Aura voice). Payment is in sandbox mode.
- [ ] In **Admin > Queue Settings** the engine is set to the mode you want to start from.
- [ ] A recorded video of the whole flow is saved locally as a backup.

## The story (one patient, start to finish)
1. **Patient books** (`/patient/book`): choose doctor and slot. Say: the booking is the first event in the log.
2. **Compounder checks the patient in** (`/compounder/queue`): the patient moves from "Not arrived" to "Waiting". Show *Call next*, *Skip*, *No-show*.
3. **Live estimate**: on the patient's dashboard show "Ahead of me" and the wait range. Check another patient in and watch the numbers move.
4. **Doctor** (`/doctor/queue`, `/doctor/chamber`): consultation start and end; the next patient's estimate updates.
5. **Lab**: the doctor orders a test; the lab technician registers the patient (`/lab/register`), the lab queue shows an expected wait, the report is marked ready; the doctor is offered a short report-review visit.
6. **Aura AI**: one short voice or chat triage example. Keep it to 60 seconds; it depends on the internet.
7. **Admin > Flow Lab** (the part that is new):
   - **Live tab**: pick the doctor; the DSS rules and the full engine are shown side by side with their ranges. Point at a patient whose "Shift" is not zero and say why: the full engine also counts booked patients who have not arrived and expected walk-ins.
   - **Simulator tab**: scenario *HospitalOPD (real hospital data)*, 60 days, Run (about 2 seconds, in the browser). Show the two ETA tables and the "Range holds" column; then the lab routing table; then the "where the numbers come from" list.
   - **Event log tab**: pick the last 7 days; show the process map (typical waiting time between check-in and call) and download the XES file.
8. **Admin > Queue Settings**: switch *Wait-time engine* to Full and save. Return to a patient's screen: the wait range now carries the one-line explanation.

## What to say about the results (and what not to)
- Say: the engine gives a wait **range** that holds close to the 80% it is built for (about 81% in the simulation); the original DSS-rule range held less than half the time (48%).
- Say: on the point estimate (MAE) the full engine is only slightly better than a simple "history mean" baseline (16.8 vs 17.2 minutes). The gain is in the range, not in magic accuracy.
- Say: the simulator's scenario is calibrated on a public hospital outpatient event log and on published studies; every parameter is marked cited, derived or assumed.
- Do not say: "it predicts waits accurately in our clinic". The numbers come from a simulation, not from measuring this clinic.

## Likely questions
| Question | Answer |
|---|---|
| Why is the accuracy gain small? | Consultation lengths vary a lot (coefficient of variation about 0.85), so the error cannot fall far; what can be fixed is how honest the range is. |
| Is this real patient data? | No. The simulator uses a public, anonymised event log for calibration; the app demo uses fake patients. |
| What if the engine is wrong? | The default mode is the original DSS rules; an admin switches modes, and every settings change is logged. |
| Who can see the event log? | Admins only, read-only, pseudonymous IDs. |
| How is access controlled? | PostgreSQL Row Level Security and role checks inside the database functions. |

## If something fails during the demo
| Symptom | What to do |
|---|---|
| Site slow on first click | It was asleep; wait a few seconds and continue. |
| Aura voice does not connect | Switch to the chat box; if that fails, show the recording. |
| Lab vision does not return | Show a result you prepared earlier in the lab reports page. |
| Live tab shows no patients | The day has no active queue; check in a patient (or use the Simulator tab, which needs no data). |
| Anything else | Play the recorded video and continue with Flow Lab > Simulator, which runs entirely in the browser. |

## Checklist for the dry run (tick each, with a second person watching)
- [ ] All five roles can log in and reach their home screen.
- [ ] Booking, check-in, call next, consultation end work and update the patient's screen.
- [ ] Lab order, registration, queue, report ready, report-review offer.
- [ ] Payment (sandbox), Aura voice, lab report vision.
- [ ] Flow Lab: Live, Simulator, Event log (including both downloads).
- [ ] Queue Settings: engine switch saves and the patient screen changes accordingly; switch back to the starting mode.
- [ ] Mobile phone view of the patient dashboard.
