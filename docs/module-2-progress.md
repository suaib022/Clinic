# Module 2: Patient Records Vault Progress

## Requirements Checklist

### Patient
- [x] **V01**: `/patient/records` with patient switcher and "Visits" / "General documents" sections. Filters (profile, doctor, category, date, title). Empty states.
- [x] **V02**: Document card with metadata (uploaded by, size, type). Actions: View (lightbox/signed URL), Download, Delete.
- [x] **V03**: Upload form: profile, 1-10 files, category, title, date, notes, "attach to visit". Supports partial success/retry.
- [x] **V04**: Visit card has "Add document" which preselects that visit.
- [x] **V05**: Delete rules: Patient can only soft-delete self-uploaded documents.
- [x] **V06**: `/patient/records/access-log` showing who accessed records, filterable.

### Doctor
- [x] **V07**: `/doctor/patients`: Patients with non-cancelled appointments. Search, last visit, next appointment. Paginated.
- [x] **V08**: `/doctor/patients/[id]`: Complete history from ALL sources, grouped by date. 404 without relationship. Audited opens.
- [x] **V09**: Doctor upload on patient page using shared upload component; optional "attach to visit" limited to doctor's own visits.

### Compounder
- [x] **V10**: `/compounder/upload`: Today's patients of assigned doctor (no clinical data).
- [x] **V11**: Upload form for compounder. After success, show only a receipt.
- [x] **V12**: "Recent uploads" receipts (24h) via SECURITY DEFINER RPC. Retract within 15 mins. No clinical metadata.
- [x] **V13**: Proof of write-only: No access to documents, signed URLs, or metadata beyond V12. Explanatory state if no assigned doctor.
- [x] **V21**: Eligibility enforced in DB: patient has non-cancelled appointment with assigned doctor today/yesterday.

### Admin
- [x] **V14**: Admin can read/soft-delete any document via RLS and RPCs (audited). No UI in this module.

### Security and Storage
- [x] **V15**: Authorization lives in the DATABASE (RLS / triggers / RPCs).
