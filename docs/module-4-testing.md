# Module 4: Compounder Portal Testing Guide

## Part 1: 10-Minute Smoke Path

Follow these steps exactly to verify the entire happy path works.

1. Run `npm run verify` to see the existing Compounder accounts and verify the DB functions are loaded.
2. Go to `http://localhost:3000/login` and log in as the test compounder (`compounder_test@staff.clinic.local`, pass: `123456`).
3. You will land on the Dashboard. Verify you see "Today's Appointments", session status, and counts.
4. Click **Bookings** in the sidebar. Verify the "Today" tab shows a list of today's patients.
5. In the "Today" tab, search for a patient by typing their name or mobile number in the search bar. The list should instantly filter.
6. Click **Check In** on a scheduled appointment. It should instantly change to a blue "Checked In" badge and show the check-in time.
7. Click **Undo Check-in** on the same appointment. It should revert to Scheduled.
8. Click **Add Walk-in** from the sidebar. 
9. Enter a random fake mobile number (e.g. `01999999999`) and click Search. It should say "No patient found" and offer to register them.
10. Click **Register New Patient**. Fill out a fake name (e.g., "John Doe") and register. You will see their new PIN.
11. On Step 3 (Booking Details), select "New Visit", toggle **Priority** on, type "Emergency", and click **Confirm Walk-in**.
12. Step 4 will show a printable Walk-in slip with their Serial Number and PIN. Click **View Bookings** to see them at the bottom of today's list with a red Priority flag and a Walk-in badge.

## Part 2: Manual Verification Matrix

| Requirement | Test Steps | Expected Result |
|-------------|------------|-----------------|
| **C07: Undo Check-in** | Check a patient in. Wait 6 minutes (or backdate in Supabase SQL editor by `UPDATE appointments SET checked_in_at = NOW() - INTERVAL '6 minutes' WHERE id = '...';`), then click Undo Check-in. | UI shows error: "The undo window (5 minutes) has expired." |
| **C08: Lookup Rate Limit** | Go to Walk-in, repeatedly enter a number and hit enter 30+ times rapidly. | UI shows error: "Too many lookups. Please wait a few minutes." |
| **C09: PIN Generation** | Complete a walk-in for a brand new mobile number. | The final slip shows a 6-digit PIN which is never displayed again. |
| **C11: Retract Walk-in** | Create a walk-in. Go to Bookings. Click "Retract Walk-in". | Appointment disappears (cancelled). Reverts if tried after 5 min. |
| **C14: Assignment Sync** | In Supabase, set the compounder's `assigned_doctor_id` to `NULL`. Refresh the browser. | Dashboard instantly locks with "No Doctor Assigned" warning. |

## Part 3: Security Checks (Supabase SQL Editor)

Paste these into the Supabase SQL editor to verify the backend cannot be bypassed. Replace UUIDs with real ones from your DB.

```sql
-- Set session to compounder
set local role authenticated;
set local request.jwt.claim.sub = 'COMPOUNDER_UUID_HERE';
set local request.jwt.claim.role = 'compounder';

-- 1. Try to check in a patient for TOMORROW
-- (Find an appointment ID for tomorrow)
SELECT public.check_in_appointment('APPOINTMENT_ID_FOR_TOMORROW');
-- EXPECTED: ERROR: Can only check in appointments for today

-- 2. Try to retract an ONLINE booking
-- (Find an appointment ID where visit_source = 'online' and status = 'checked_in')
SELECT public.retract_walk_in('APPOINTMENT_ID_ONLINE');
-- EXPECTED: ERROR: Cannot retract online bookings

-- 3. Try to hit the lookup rate limit instantly (run multiple times)
SELECT public.lookup_patient_for_walk_in('01888888888');
```

## Part 4: If a step fails

If any step fails, please copy and provide the following:
1. The exact error message shown in the UI popup (red banner) or on the page.
2. The browser console error (Right Click > Inspect > Console).
3. The server terminal output where `next dev` is running.

## Part 5: Settings to Check by Hand

Please verify the following manually in your environment:
- **Timezone**: Ensure your system timezone is correct, or check that `Asia/Dhaka` conversions are behaving correctly in the UI. 
- **Roles**: Ensure your test compounder is actually assigned to a valid doctor in the `compounders` table. Use `npm run verify` to confirm.
