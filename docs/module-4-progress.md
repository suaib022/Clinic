# Module 4 Progress

## Shell and dashboard
- [ ] C01 Compounder layout (nav: Dashboard, Bookings, Add walk-in, Upload). Empty state if no doctor.
- [ ] C02 `/compounder/dashboard` real data.

## Bookings
- [ ] C03 `/compounder/bookings` tabs (Today, Upcoming, Previous).
- [ ] C04 Row details (serial, time, patient name + UHID, mobile, gender, Online/Walk-in, visit type, priority, status badge, check-in time). No age/medical links.
- [ ] C05 Search inside assigned doctor's appointments. Status filter, date range, pagination, URL sync.
- [ ] C06 Today actions: Check in, Mark no-show, Set priority.
- [x] C07 Undo check-in within 5 minutes.

## Walk-ins
- [x] C08 `/compounder/walk-in` step 1 (patient lookup by exact UHID/mobile). Rate limited. `staff_lookup_log`.
- [ ] C09 Step 2 for new patient. Slip generation, PIN shown once, confirmation required.
- [x] C10 Step 3 (visit type, priority, creation). `create_walk_in_appointment` RPC.
- [x] C11 Retract walk-in within 5 minutes.

## Uploads
- [ ] C12 Each Today row has "Upload document" button.

## Privacy and security
- [ ] C13 Explicit response allowlists.
- [ ] C14 Assignment changes take effect immediately.
- [x] C15 Data model (`visit_source`, partial unique slot index, `created_by_user_id`, `walk_in_requests`, `staff_lookup_log`).
- [x] C16 Authorization in the DATABASE (SECURITY DEFINER, RLS).

## Quality
- [ ] C17 Polling/refresh every 30s.
- [ ] C18 Time zone handling (Asia/Dhaka).
- [ ] C19 Loading, empty, error states. Paginated.
- [ ] C20 Navigation / shared components.
- [ ] C21 Seed data and tooling.
