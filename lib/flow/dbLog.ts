// Maps the web app's queue_events rows to flowq FlowEvents (for OCEL / XES export). Pure; no Supabase here.
import type { FlowActivity, FlowEvent, FlowObjectRef } from '../../packages/flowq/src';

export interface QueueEventRow {
  id: string;
  appointment_id: string | null;
  doctor_id: string;
  event_type: string;
  actor_role: string | null;
  occurred_at: string;
  session_id: string | null;
  request_key?: string | null;
  metadata: Record<string, unknown> | null;
}
export interface ApptRow { id: string; patient_id: string; booked_at: string | null }

/** DSS canonical event names → log activities. 'call_next' starts the consult, so it yields two activities. */
const MAP: Record<string, FlowActivity[]> = {
  check_in: ['check_in'], call_next: ['call', 'consult_start'], end_consult: ['consult_end'], skip: ['skip'], rejoin: ['rejoin'],
  no_show: ['no_show'], priority_set: ['priority_set'], walk_in_added: ['walk_in'], session_start: ['session_start'],
  pause: ['session_pause'], resume: ['session_resume'], session_end: ['session_end'],
};

/**
 * Rules: only DSS rows (metadata.dss = true; the legacy Module 4 duplicates are skipped); an 'undo' row removes the row named
 * in metadata.undo_of and stays in the log as an 'undo' event (a deviation worth analysing); a repeated request_key is kept once; each appointment gets a 'book' event at booked_at.
 */
export function mapQueueEvents(rows: QueueEventRow[], appts: ApptRow[]): FlowEvent[] {
  const dss = rows.filter((r) => r.metadata?.dss === true);
  const undone = new Set(dss.filter((r) => r.event_type === 'undo').map((r) => String(r.metadata?.undo_of ?? '')));
  const seenKeys = new Set<string>();
  const patientOf = new Map(appts.map((a) => [a.id, a.patient_id]));
  const out: FlowEvent[] = [];

  for (const a of appts) {
    if (!a.booked_at) continue;
    out.push({ id: `book-${a.id}`, activity: 'book', time: Date.parse(a.booked_at), objects: [{ type: 'patient', id: a.patient_id }, { type: 'appointment', id: a.id }], attrs: { role: 'patient' } });
  }
  for (const r of [...dss].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at))) {
    if (undone.has(r.id)) continue;
    if (r.request_key) {
      const k = `${r.event_type}:${r.request_key}`;
      if (seenKeys.has(k)) continue;
      seenKeys.add(k);
    }
    const acts: FlowActivity[] | undefined = r.event_type === 'undo' ? ['undo'] : MAP[r.event_type];
    if (!acts) continue;
    const objects: FlowObjectRef[] = [{ type: 'doctor', id: r.doctor_id }];
    if (r.session_id) objects.push({ type: 'doctor_session', id: r.session_id });
    if (r.appointment_id) {
      objects.push({ type: 'appointment', id: r.appointment_id });
      const pid = patientOf.get(r.appointment_id);
      if (pid) objects.push({ type: 'patient', id: pid });
    }
    acts.forEach((activity, i) => out.push({
      id: acts.length > 1 ? `${r.id}-${i}` : r.id, activity, time: Date.parse(r.occurred_at), objects,
      attrs: activity === 'undo' ? { role: r.actor_role ?? null, undone: String(r.metadata?.undone_type ?? '') } : { role: r.actor_role ?? null },
    }));
  }
  return out.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}
