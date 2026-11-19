// Report-review visits: a patient back with a lab report takes reportReviewMin, not a full visit.
import { describe, it, expect } from 'vitest';
import { computeEstimates, DEFAULT_SETTINGS, MIN, type EngineInput, type QueueAppointment } from '../../packages/flowq/src';

const T0 = Date.UTC(2026, 10, 17, 12, 0); // 18:00 Dhaka
const appt = (id: string, serial: number, checkedMin: number, extra: Partial<QueueAppointment> = {}): QueueAppointment => ({
  id, serialNo: serial, status: 'checked_in', bookedAt: T0 + checkedMin * MIN, checkedInAt: T0 + checkedMin * MIN,
  priorityLevel: 0, visitType: 'new', visitSource: 'walk_in', ...extra,
});
const input = (appointments: QueueAppointment[]): EngineInput => ({
  now: T0 + 5 * MIN,
  settings: DEFAULT_SETTINGS,
  session: { state: 'active', startedAt: T0, scheduledStartAt: T0, scheduledEndAt: T0 + 180 * MIN, pauses: [] },
  appointments,
  history: { new: [], follow_up: [] },
  slotMinutes: 10,
});

describe('report review', () => {
  it('default setting is 4 minutes', () => expect(DEFAULT_SETTINGS.reportReviewMin).toBe(4));

  it('a report review ahead adds reportReviewMin, not a full slot', () => {
    const r = computeEstimates(input([
      appt('A', 1, 0, { visitType: 'follow_up', visitReason: 'report_review' }),
      appt('B', 2, 1),
    ]));
    expect(r.estimates.B.expectedStartAt).toBe(T0 + 5 * MIN + 4 * MIN);
  });

  it('a normal visit ahead still uses the slot length', () => {
    const r = computeEstimates(input([appt('A', 1, 0), appt('B', 2, 1)]));
    expect(r.estimates.B.expectedStartAt).toBe(T0 + 5 * MIN + 10 * MIN);
  });
});
