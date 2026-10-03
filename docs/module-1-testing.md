# Module 1 (Appointment Lifecycle) - Manual Testing Guide

This guide details how to verify the backend rules, state transitions, and API handlers built in Module 1. Since the application cannot be tested via an automated browser internally, these steps require manual UI and database testing.

## Prerequisites
1. Start the local server: `npm run dev`
2. Open `http://localhost:3000`
3. Have the Supabase Dashboard or CLI ready for SQL querying.

## 1. Status Lifecycle Verification (Rules 1, 2, 4, 8)

### Action 1: Create an Appointment
- **UI:** Log in as a Patient, select a doctor, and book an appointment.
- **Verification:** 
  - Ensure the modal shows the `serial_no`.
  - Check the `appointments` table: status should be `scheduled`, `scheduled_start` should match the exact booking slot, and `serial_no` should be `> 0`.
- **Constraint Test (Rule 8):** Try booking the *exact same slot* for another patient concurrently using `curl` or Postman. The API should return `409 Slot taken`. Try booking another appointment for the same patient with the same doctor on the same day. It should return `409 You already have an active appointment...`.

### Action 2: Check-In (Rule 2)
- **API Call:** Send a `POST` request to `/api/appointments/<appt-id>/check-in` as an authenticated doctor, compounder, or admin.
- **Verification:** 
  - Check the DB: status should be `checked_in`, `checked_in_at` should be NOT NULL.
  - Check `queue_events` table: A new event with `event_type = 'checked_in'` should exist.

### Action 3: Start Consultation
- **API Call:** Send a `POST` request to `/api/appointments/<appt-id>/start`.
- **Verification:**
  - Check DB: status should be `in_consultation`, `consultation_started_at` is NOT NULL.
  - Check `queue_events`: Event added.

### Action 4: Complete Consultation
- **API Call:** Send a `POST` request to `/api/appointments/<appt-id>/complete`.
- **Verification:**
  - Check DB: status should be `completed`, `consultation_ended_at` is NOT NULL.
  - **Rule 4 (No reversal):** Try calling the `/check-in` or `/start` API again for this appointment. It must fail.

### Action 5: Cancellation & No-Show
- **API Call:** Book another appointment. Send a `POST` request to `/api/appointments/<appt-id>/cancel`.
- **Verification:** Status must be `cancelled`, `cancelled_at` is NOT NULL, and `cancel_reason` is recorded.
- **API Call:** Book another appointment, check it in. Send a `POST` request to `/api/appointments/<appt-id>/no-show`.
- **Verification:** Status must be `no_show`.

## 2. Priority Rules Verification (Rule 5 & 6)

### Action: Mark as Emergency
- **API Call:** Send a `POST` request to `/api/appointments/<appt-id>/priority` with a JSON payload `{ "reason": "Severe pain" }`.
- **Verification:** Check the `appointments` table. `is_priority` must be `TRUE`, and `priority_reason` must match your input.
- **Expected UI Behavior:** When the queue UI is built, this patient should appear at the top.

## 3. Strict Append-Only Queue Events (Rule 9)

### Action: Attempt to modify a queue event
- **DB Verification:** Run the following SQL against your local Supabase DB:
  ```sql
  UPDATE queue_events SET event_type = 'hacked' WHERE id = <some_valid_event_id>;
  DELETE FROM queue_events WHERE id = <some_valid_event_id>;
  ```
- **Expected Outcome:** Both commands MUST fail with a trigger error `queue_events are append-only...`. This proves the audit trail is immutable.

## 4. Doctor Session Constraints (Rule 3)

### Action 1: Start Session
- **API Call:** Send a `POST` request to `/api/doctor/session/start` with payload `{ "doctor_id": "<uuid>" }` as the doctor or admin.
- **Verification:** Check `doctor_sessions`. A record should exist with `status = 'open'`.

### Action 2: Prevent Duplicate Sessions
- **API Call:** Send the exact same `start` request again.
- **Expected Outcome:** Must fail with "Session already active for today".

### Action 3: Pause & Resume Session
- **API Call:** Send `POST` to `/api/doctor/session/pause` with payload `{ "doctor_id": "<uuid>", "reason": "Lunch break" }`.
- **Verification:** `doctor_sessions.status` = `paused`. A new record in `doctor_session_pauses` with `resumed_at` as NULL.
- **API Call:** Send `POST` to `/api/doctor/session/resume` with payload `{ "doctor_id": "<uuid>" }`.
- **Verification:** `doctor_sessions.status` = `open`. The `resumed_at` column in the pauses table is now populated.

### Action 4: End Session
- **API Call:** Send `POST` to `/api/doctor/session/end`.
- **Verification:** `doctor_sessions.status` = `ended`. Any active pause records should be automatically closed.

## 5. Security & Isolation (Rule 10 & 7)

### Action 1: Direct Status Modification Blocked (Rule 10)
- **DB Verification:** As an admin or patient (using PostgREST API with a bearer token, or running the `npm run test:m1` script), attempt to `UPDATE appointments SET status = 'completed'`.
- **Expected Outcome:** RLS or Trigger will reject it. All changes *must* go through the RPC functions (`check_in_appointment`, etc.).

### Action 2: Safe Deletion Block (Rule 7)
- **DB Verification:** Attempt to delete a past completed appointment.
  ```sql
  DELETE FROM appointments WHERE status = 'completed';
  ```
- **Expected Outcome:** Should be blocked by a trigger or FK constraints if referenced, enforcing that historical medical encounters are preserved. (Covered partially by RLS which prevents DELETE for most users).

## NEEDS MANUAL VERIFICATION BY ME (BROWSER REQUIRED)
- **Patient Dashboard UI:** Login as a patient and verify that the dashboard accurately shows the new status badges from `lib/appointmentStatus.ts` (e.g., Scheduled, Checked In) and the new `Serial No` column.
- **Admin Dashboard UI:** Login as an admin and verify that the dashboard correctly renders the new badges.
- **Booking Flow UI:** Go through the booking flow and verify the Success Modal displays the Serial No, Doctor Name, Date, and Time accurately.
