# 🏥 Clinic Management & Intelligent Healthcare System

An enterprise-grade clinic operating system and healthcare platform engineered with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase (PostgreSQL & Storage)**. The system provides real-time queue intelligence, dual-mode clinical triage, paperless medical records, and role-tailored workflows for patients, doctors, compounders, and clinic administrators.

---

## 🌟 Key Modules & Core Capabilities

### 1. 🤖 Aura AI Healthcare Assistant
* **Dual-Mode Clinical Assistant:** Bidirectional voice (WebRTC via ElevenLabs) and real-time interactive text chat with live audio waveform visualization.
* **Intelligent Clinical Triage:** Evaluates symptoms, determines clinical urgency levels, and guides patients to the appropriate medical specialties.
* **Generative UI Action Cards:** In-chat interactive cards for appointment booking confirmation, prescription refills, and clinical escalation without leaving the conversation.
* **Automated Settlement Sync:** Background settlement loops capture transcripts and clinical attachments directly into patient records.

---

### 2. ⚡ Live Queue & Decision Support System (DSS)
* **Real-Time Dynamic Ordering:** Deterministic queue ordering engine considering priority statuses, check-in timestamps, and scheduled slot windows.
* **Wait Time & ETAs:** Dynamic calculation of expected visit durations and wait times based on historical consultation benchmarks.
* **Compounder Live Console:** 
  * Seamless chamber controls: *Call Next*, *Mark In Chamber*, *Consultation Done*, *Skip*, and *No-Show*.
  * Multi-session management: Start, pause, conclude, and restart multiple sessions per doctor in a single day.
  * Real-time metrics bar: Serving Inside, Present & Waiting, Rx Pending, and Visits Completed.
  * Proactive DSS suggestions with quick dismiss and confirmation actions.
* **Comprehensive Visit Details Modal:** Rich pop-up modal displaying full schedule timings, queue progress, and uploaded prescription documents.

---

### 3. 👥 Patient Portal & Records Vault
* **Online Booking & Slot Selection:** Easy appointment scheduling by doctor, specialty, and time slot.
* **Digital Appointment Slips:** Instant generation and PDF download for OPD tickets, payment receipts, and prescriptions.
* **Family Profile Management:** Book and manage appointments for family dependents under a single primary account.
* **Paperless Records Vault:** Upload, view, and organize medical documents, diagnostic imaging, and laboratory test reports.
* **Export Health Records:** One-click ZIP archive export and consolidated clinical health summary PDF generation.

---

### 4. 🩺 Doctor Chamber & Clinical Desk
* **Live Consultation Queue:** Instant visibility of patients waiting outside, consultation status, and priority tags.
* **Patient Medical History:** Timeline view of previous consultations, diagnoses, allergies, and uploaded reports.
* **Electronic Prescription Authoring:** Direct prescription generation with dosage instructions and visit completion triggers.

---

### 5. 📑 Automated Health Data Extraction
* **Smart Medical Document Extraction:** Automated parsing of uploaded prescription images and diagnostic test results.
* **Structured Health Profiles:** Automatically extracts vitals, active medications, test results, and conditions into structured patient profiles.

---

### 6. 📊 Admin Management & Analytics
* **Doctor & Schedule Operations:** Configure doctor visiting hours, chamber allocations, and leave management.
* **Queue Performance Reports:** Detailed audit metrics on average patient wait times, doctor consultation speeds, and no-show rates.
* **Staff & User Role Administration:** Granular role-based access control (Admin, Doctor, Compounder, Patient) powered by PostgreSQL Row Level Security (RLS).

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **UI & Styling** | React 19, Tailwind CSS v4, Lucide Icons, Base UI |
| **Database & Auth** | Supabase (PostgreSQL with RLS, Triggers, RPCs, Storage) |
| **Voice & AI** | ElevenLabs Client, n8n Automation Engine |
| **PDF & Export** | jsPDF, html2canvas, fflate |
| **Testing & Quality** | Vitest, Testing Library, ESLint |

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: `v20.x` or higher
* **npm**: `v10.x` or higher
* **Supabase**: Active Supabase project with database migrations applied

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/suaib022/Clinic.git
cd Clinic
npm install
```

### 2. Environment Configuration
Create a `.env.local` file in the root directory and supply your project credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Database Migrations
Apply database schema and migrations:
```bash
# Migrations are located in supabase/migrations/
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

```bash
# Run all unit and queue decision support tests
npm test

# Run queue console UI tests specifically
npx vitest run tests/dss/ui/queue-console.test.tsx

# Create an optimized production build
npm run build
```

---

## 🔒 Security & Privacy

* **Row Level Security (RLS):** Strict database policies prevent unauthorized access across user roles.
* **Auditability:** Complete transaction history tracking for all queue movements, appointment status transitions, and medical record accesses.
* **Encrypted Storage:** Private signed URLs for patient medical files, lab tests, and prescription uploads.
