// Wait a report review joining the doctor's line now would get, from the same engine the patients see. Pure.
import { computeEstimates, type EngineInput } from './engine';

export function reviewWaitMin(input: EngineInput): number {
  const probe = {
    id: '__review_probe__', serialNo: 0, status: 'checked_in' as const, bookedAt: input.now, checkedInAt: input.now,
    slotMinutes: input.slotMinutes ?? null, priorityLevel: 0 as const, visitType: 'follow_up' as const,
    visitReason: 'report_review' as const, visitSource: 'walk_in' as const,
  };
  const r = computeEstimates({ ...input, appointments: [...input.appointments, probe] });
  const at = r.estimates[probe.id]?.expectedStartAt;
  return at == null ? 0 : Math.max(0, Math.round((at - input.now) / 60_000));
}
