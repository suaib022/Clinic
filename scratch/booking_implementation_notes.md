# Appointment Booking Feature Implementation Notes

## 1. Database Migration & Seed Data
I have created a Python script `scratch/generate_booking_migration.py` which parsed the massive `labaid_complete_data.json` file. It automatically extracted all unique specialities, mapped them to their respective doctors, and generated a highly-optimized SQL migration file located at `supabase/migrations/20261001000000_create_booking_schema.sql`.

### How to apply the migration:
Make sure your Supabase environment (local or remote) is running and configured, then run:
```bash
npx supabase migration up
```
*Note: If you are using a hosted Supabase project, you will need to push this migration to your remote database using `npx supabase db push` or by executing the SQL directly in the Supabase Dashboard SQL editor.*

**Migration features:**
- Creates `specialities`, `doctor_specialities`, `doctor_schedules`, `doctor_schedule_breaks`, `doctor_leave_requests`, and `appointments` tables.
- Implements a unique constraint `UNIQUE(doctor_id, appointment_date, start_time)` on the `appointments` table to prevent double booking race conditions at the database level.
- Seeds the initial schedule for **every** existing doctor: Mon-Thu, Sat-Sun (9:00 AM - 8:00 PM) with 10-minute slot durations, and inserts default break periods (1-2:30 PM, 4:40-5:20 PM, 6:40-7:20 PM).

## 2. API Endpoints (Services & Models)
I have built standard Next.js Route Handlers to power the booking feature. All timezone calculations ensure `Asia/Dhaka` consistency using `date-fns` and `date-fns-tz`.
- `GET /api/specialities`: Returns all distinct specialities.
- `GET /api/doctors?speciality_id={id}`: Returns doctors filtered by speciality.
- `GET /api/doctors/[id]`: Returns a specific doctor's profile and weekly schedule.
- `GET /api/doctors/[id]/slots?date=YYYY-MM-DD`: Computes 10-minute slots. It filters out slots overlapping with scheduled breaks, approved leaves (full/partial), existing bookings, and past times for the current day.
- `POST /api/appointments`: Books a slot securely and catches `23505` (unique violation) to gracefully inform the user if a slot was just taken.

## 3. UI Implementation
- **Patient Booking Page (`/appointment`)**: Modeled exactly after the Labaid reference screenshot. It features the doctor profile & schedule panel on the left and the interactive booking form & slot grid on the right. 
- **Admin Dashboard (`/admin/schedule`)**: A scaffolded interface where admins can manage doctor schedules, approve/reject leaves, and define overrides.
- **Doctor Portal (`/doctor/leave`)**: A scaffolded interface for doctors to submit full-day leaves or partial-day breaks.

## 4. Testing the Flow
1. Run `npm install` to ensure the new `date-fns` and `date-fns-tz` dependencies are installed.
2. Run the database migration.
3. Start the dev server (`npm run dev`) and navigate to `/appointment`.
4. Select a Speciality, pick a Doctor, and pick a Date to see the robust slot generation in action.
5. You can test concurrent bookings by attempting to book the same slot simultaneously across two different browser tabs. The unique constraint guarantees only one will succeed.

### Assumptions Made
- The app enforces that only logged-in users (patients) can book appointments (via `supabase.auth.getSession()` in the POST endpoint). You might need to adjust auth headers if using a different auth flow.
- A flat consultation fee of `Taka. 1200` is currently mocked in the API since the DB schema didn't natively have this mapped to doctors yet.
- I assumed the user will manage the connection to their specific remote Supabase instance, hence I provided the generated SQL file directly rather than forcing a remote connection without credentials.
