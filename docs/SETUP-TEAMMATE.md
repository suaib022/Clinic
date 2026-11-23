# Run the Clinic app on a new Mac

This guide gets the app running against the shared online Supabase project, with the same screens and data as the main developer.

Tested on 2026-11-19 from a fresh clone of `main` (commit `33d4202`): `npm install`, `next build`, the login page, and the lab route guard all worked.

## What you need

- Git
- Node.js 20.9 or newer (Next.js 16 requires it)
- The private `.env.local` file from the project owner (see step 3)

Docker is not needed for this guide.

## Steps

1. Get the code.

   ```bash
   git clone https://github.com/suaib022/Clinic.git
   cd Clinic
   npm install
   ```

   If you already have the repository, run `git pull origin main` and `npm install` instead.

2. Check that nothing in your shell points to another database.

   ```bash
   env | grep -i supabase
   ```

   This should print nothing. If it prints a `NEXT_PUBLIC_SUPABASE_URL`, unset it, because it overrides `.env.local`.

3. Add `.env.local` in the `Clinic` folder. The file is not in Git, so ask the project owner to send it to you privately. Never post it in chat or commit it. It holds these keys:

   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `EXTRACTION_CRON_SECRET`, `OPENROUTER_API_KEY`, `EXTRACTION_MODEL`

4. Start the app.

   ```bash
   npm run dev
   ```

   Open http://localhost:3000/login.

5. Sign in. Choose the **Lab** tab and use `lab_1@staff.clinic.local` with the password the project owner gives you. You land on `/lab/dashboard`.

   For Doctor, Compounder, Admin and Patient, use the test accounts listed in `pass.md` and `test-patients.md`.

## What you should see

- Lab: `/lab/dashboard`, `/lab/queue`, `/lab/register`, `/lab/reports`
- Admin: `/admin/lab-settings`
- Doctor and compounder queue screens with the lab panels
- The patient dashboard with the lab card

## Things to know

- The app writes to the shared online database. A booking or lab order you create is visible to everyone, so use test patients only.
- The database tests (`npm run verify`, `tests/*/db`) need a local Docker Supabase. Do not point them at the online project.
- Unit tests need no database: `npx vitest run tests/lab/unit`.
- Optional library checks: `npm run flowq:bench` and `packages/flowq/experiments/run-all.sh`. The process-mining analysis in `analysis/` needs Python and `uv`.

## Troubleshooting

- **"Invalid credentials" on a correct password:** the app is connected to the wrong database. Check step 2, then restart `npm run dev`.
- **Blank data or 500 errors:** `.env.local` is missing or incomplete.
- **Port 3000 is busy:** run `npx next dev -p 3001`.
