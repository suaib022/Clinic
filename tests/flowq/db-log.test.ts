import { describe, it, expect } from 'vitest';
import { mapQueueEvents, type QueueEventRow } from '@/lib/flow/dbLog';

const row = (id: string, event_type: string, min: number, extra: Partial<QueueEventRow> = {}): QueueEventRow => ({
  id, appointment_id: 'a1', doctor_id: 'd1', event_type, actor_role: 'compounder', session_id: 's1',
  occurred_at: new Date(Date.UTC(2026, 10, 17, 12, min)).toISOString(), request_key: null, metadata: { dss: true }, ...extra,
});
const APPTS = [{ id: 'a1', patient_id: 'p1', booked_at: '2026-11-17T12:00:00.000Z' }];
const acts = (rows: QueueEventRow[]) => mapQueueEvents(rows, APPTS).map((e) => e.activity);

describe('mapQueueEvents', () => {
  it('undo removes the undone event and stays as an undo event', () => {
    const rows = [row('e1', 'check_in', 1), row('e2', 'skip', 2), row('e3', 'undo', 3, { metadata: { dss: true, undo_of: 'e2', undone_type: 'skip' } })];
    expect(acts(rows)).toEqual(['book', 'check_in', 'undo']);
    expect(mapQueueEvents(rows, APPTS).at(-1)!.attrs.undone).toBe('skip');
  });
  it('legacy rows without the dss flag are ignored', () => {
    expect(acts([row('e1', 'checked_in', 1, { metadata: {} }), row('e2', 'check_in', 1)])).toEqual(['book', 'check_in']);
  });
  it('call_next becomes call + consult_start', () => {
    expect(acts([row('e1', 'call_next', 5)])).toEqual(['book', 'call', 'consult_start']);
  });
  it('a repeated request key is kept once', () => {
    expect(acts([row('e1', 'check_in', 1, { request_key: 'k-123456' }), row('e2', 'check_in', 1, { request_key: 'k-123456' })]))
      .toEqual(['book', 'check_in']);
  });
  it('events carry the patient from the appointment', () => {
    expect(mapQueueEvents([row('e1', 'check_in', 1)], APPTS)[1].objects).toContainEqual({ type: 'patient', id: 'p1' });
  });
});
