# Module 4 Audit

## Existing Modules
- **Module 0 (Auth)**: Present.
- **Module 1 (Appointments)**: Present (lifecycle, triggers, functions).
- **Module 2 (Records)**: Present (including write-only `compounder/upload` page).
- **Module 3 (Doctor portal)**: Not fully present (placeholder at `/doctor/appointments`).

## Current Compounder Pages
- `app/compounder/dashboard`: Exists, might be static. Needs updating.
- `app/compounder/patients`: Exists. Needs to be removed or adapted? Wait, requirements say: Dashboard, Bookings, Add walk-in, Upload. So `patients` might be replaced by `bookings` and `walk-in`.
- `app/compounder/upload`: Exists. (Module 2).

## Database state
- **compounders table**: Exists with `assigned_doctor_id`.
- **appointments trigger**: `BEFORE UPDATE ON public.appointments` (validates state transitions).
- **Unique slot index**: `idx_unique_active_slot` currently exists on `(doctor_id, appointment_date, start_time) WHERE status != 'cancelled'`. Needs to be made partial for `visit_source = 'online'`.
- **Walk-in / serial code**: Serial generation currently exists in Module 1. Walk-in requests table and `staff_lookup_log` do not exist. `visit_source` column might not exist.
