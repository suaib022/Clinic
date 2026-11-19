import { describe, it, expect } from 'vitest';
import { doctorLabView, labLaterKey, reviewLaterKey, type RawDoctorLabVisit } from '@/lib/lab/doctorLab';

const T = Date.UTC(2026, 10, 18, 13, 0); // 19:00 Dhaka
const MIN = 60_000;
const visit = (status: string, tests: [string, string][], review: string | null = null): RawDoctorLabVisit => ({
  appointment_id: 'a1', serial_no: 3, status, patient_name: 'P', patient_uhid: 'U',
  tests: tests.map(([id, st]) => ({ order_id: id, name: id, line_id: 'L', status: st, turnaround_min: 60, collected_at: null, report_ready_at: null })),
  review_appointment_id: review,
});
const session = { state: 'active' as const, scheduledStartAt: T - 60 * MIN, scheduledEndAt: T + 120 * MIN, startedAt: T - 60 * MIN, pauses: [] };
const ctx = { now: T, session, reviewWaitMin: 20, dismissed: [] as string[] };

describe('doctor lab view', () => {
  it('offers Lab now / Later only after the visit, for orders not yet sent', () => {
    expect(doctorLabView([visit('in_consultation', [['o1', 'ordered']])], ctx)[0].showLabChoice).toBe(false);
    const v = doctorLabView([visit('prescription_pending', [['o1', 'ordered'], ['o2', 'queued']])], ctx)[0];
    expect(v.showLabChoice).toBe(true);
    expect(v.undecidedOrderIds).toEqual(['o1']);
  });
  it('"Later" hides the choice for the day', () => {
    expect(doctorLabView([visit('completed', [['o1', 'ordered']])], { ...ctx, dismissed: [labLaterKey('a1')] })[0].showLabChoice).toBe(false);
  });
  it('a ready report brings the review offer with the engine advice: same day at now + 10 min walk + 20 min wait', () => {
    const v = doctorLabView([visit('completed', [['o1', 'report_ready']])], ctx)[0];
    expect(v.showReviewOffer).toBe(true);
    expect(v.advice).toEqual({ kind: 'same_day', expectedStartAt: T + 30 * MIN });
  });
  it('near the end of the session the advice is to book later', () => {
    const late = { ...ctx, session: { ...session, scheduledEndAt: T + 25 * MIN } };
    expect(doctorLabView([visit('completed', [['o1', 'report_ready']])], late)[0].advice).toEqual({ kind: 'book_later', reason: 'not_enough_time' });
  });
  it('no offer once the patient is back in line, or after "Book later"', () => {
    expect(doctorLabView([visit('completed', [['o1', 'report_ready']], 'r1')], ctx)[0].showReviewOffer).toBe(false);
    expect(doctorLabView([visit('completed', [['o1', 'report_ready']])], { ...ctx, dismissed: [reviewLaterKey('a1')] })[0].showReviewOffer).toBe(false);
  });
});
