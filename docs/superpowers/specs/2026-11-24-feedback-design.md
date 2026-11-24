# Feedback: ratings, voice comments, auto-classification

Date: 2026-11-24. Status: approved; implemented (see plan). STT model used: `openai/whisper-1` (documented default in OpenRouter STT guide; env `STT_MODEL`).

## Intent
After a doctor visit or a lab test, the patient rates the experience and the hospital service, and leaves a comment (typed or spoken). Spoken comments become text automatically. A classifier tags each comment. Everything is stored so admin, doctors and lab staff can see it and the hospital can improve later. Also needed for the course demo: replace the fake "4.8 (120+ reviews)" on the homepage with real data.

## Goals
- Doctor visit feedback (extend what exists) and new lab test feedback.
- Two ratings (1-5): doctor/test experience, hospital service. Optional comment.
- Voice: mic button, record, transcribe, text lands in the comment box for the patient to edit before submit.
- Classifier: multi-label tags from {positive, negative, improvement, staff}. `staff` = anything about staff behavior or activity.
- Visibility: doctor feedback -> that doctor + admin. Lab feedback -> technician + admin. Patient sees own.
- Admin dashboard: lists, category filter, averages, category counts.
- Homepage rating from real averages.
- Cheap models only. Patients speak English.

## Non-goals
- Bangla voice or text. Audio storage (audio is never saved, only text). Public per-doctor ratings page. Editing feedback after submit. Sentiment trend charts or exports.

## Anti-goals
- Feedback submit must never fail because STT or the classifier failed.
- Changing existing `appointment_feedbacks` rows or breaking the current RPC and modal.
- A doctor seeing another doctor's feedback, or a technician seeing doctor feedback.

## Approaches considered (picked in conversation)
- Voice: browser Web Speech API (free, Chrome/Edge only) vs OpenRouter STT `/api/v1/audio/transcriptions` (all browsers, tiny cost). **Picked OpenRouter STT**, model `openai/whisper-1` (documented example model; env `STT_MODEL` overrides).
- Classifier: keyword rules vs cheap LLM. **Picked `google/gemini-2.5-flash-lite`** (reuse `EXTRACTION_MODEL` pattern, separate env `FEEDBACK_MODEL`), with a keyword-rules fallback if the LLM call fails.
- DB: one table with `kind` vs separate. **Picked** new `lab_feedbacks` table plus new columns on `appointment_feedbacks`. Keeps the shipped RPC and RLS intact.

## Design

### Data
Migration 1, `appointment_feedbacks` add: `categories text[] NOT NULL DEFAULT '{}'`, `sentiment text` (positive|neutral|negative), `input_method text NOT NULL DEFAULT 'typed'` (typed|voice), `classified_at timestamptz`. CHECK: categories subset of the 4 tags.

Migration 2, new `lab_feedbacks`: `id, lab_order_id UNIQUE FK lab_orders, patient_id, test_rating 1-5, service_rating 1-5, comment, categories text[], sentiment, input_method, classified_at, created_at, metadata jsonb`. RLS: patient reads own; technician reads all lab rows; admin reads all; no direct insert/update (RPC only).

RPC `submit_lab_feedback(p_lab_order_id, p_test_rating, p_service_rating, p_comment, p_input_method)`: SECURITY DEFINER; caller owns the order; status = `report_ready`; 7-day window from report-ready time; one per order. Extend `submit_appointment_feedback` with `p_input_method` default `'typed'` (backward compatible, same signature order).

RPC `set_feedback_classification(kind, id, categories, sentiment)`: callable only with the service role (server). Used after submit.

Doctor visibility already exists in RLS (doctor reads own). Confirm during build; do not widen.

### Server
- `POST /api/feedback/transcribe`: authenticated patient; multipart audio (max ~60 s, ~2 MB, webm/mp4/wav); forwards to OpenRouter; returns `{text}`. Audio not stored or logged. Per-user rate limit.
- `lib/feedback/classify.ts`: pure `classifyComment(text) -> {categories, sentiment}`: LLM call with strict JSON schema validated by zod; on error or invalid output, `rulesClassify(text)`. Empty comment -> no categories, sentiment from ratings.
- Server actions `submitAppointmentFeedback` (extend) and new `submitLabFeedback`: validate with zod, call RPC, then classify and call `set_feedback_classification`. Classification failure is swallowed and logged; a later backfill is possible because `classified_at` stays null.

### UI
- Shared `FeedbackForm` (two `StarRating`s, comment textarea, `VoiceInput` mic button with record/stop/transcribing states, mic-denied and unsupported fallbacks). Reuse `StarRating` from `PatientAppointmentsTable.tsx` by extracting it.
- Doctor flow: existing modal swaps its body for `FeedbackForm` (labels: "Doctor", "Hospital service").
- Lab flow: patient lab card shows "Rate your test" when status is `report_ready` and no feedback yet (labels: "Test experience", "Hospital service").
- `/admin/feedback`: tabs Doctor | Lab, filters (category, rating, date), averages, category counts, list with tag chips.
- Doctor page: own feedback list with the same chips. Technician page: lab feedback list.
- Homepage: average and count from DB; hide the block when count is 0.

### Testing
Unit: classifier (LLM mocked, rules fallback, invalid JSON), zod schemas, transcribe route validation. DB: RPC window/ownership/duplicate rules and RLS (doctor sees own only, technician sees lab only) via SQL on a local/test DB, then the online project only with explicit approval. Component tests: FeedbackForm, VoiceInput states with a mocked MediaRecorder. Real check: one live STT call and one live classify call with a short test clip/text.

### Constraints
- Online Supabase changes need explicit user approval before each apply.
- OpenRouter key from env; never logged; secrets never in commits.
- Commits only as the user's identity, with confirmation; push needs separate approval.
- Build with cheap models: delegate per-task work to Haiku/Sonnet subagents; main model only reviews.

### Left to the builder (marked as calls)
Exact STT model id and price check; recording length cap and mime handling per browser; chip colors; rules keyword lists; admin page layout details; whether to add a one-time backfill script for unclassified rows.
