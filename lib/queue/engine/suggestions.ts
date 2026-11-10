import type { EngineInput, QueueResult, Suggestion } from './types';
import { computeQueueOrder } from './order';
import { MIN, minutesBetween, round5 } from './time';

const SEVERITY_RANK = { urgent: 0, warning: 1, info: 2 } as const;

/**
 * B8: suggestions for the compounder. Nothing runs automatically; each carries one action the UI confirms with a tap.
 * `key` is stable for the same situation, so a dismissed or already-notified suggestion is not repeated.
 */
export function computeSuggestions(input: EngineInput, result: QueueResult): Suggestion[] {
  const { now, settings: s } = input;
  const order = computeQueueOrder(input.appointments, s);
  const state = result.session.state;
  const out: Suggestion[] = [];
  const add = (x: Omit<Suggestion, 'id'>) => out.push({ ...x, id: x.key });

  // Doctor is free and someone is waiting.
  if (state === 'active' && !order.current && order.line.length > 0) {
    const next = order.line[0];
    add({
      key: `call_next:${next.id}`, type: 'call_next', severity: 'info',
      message: `Doctor is free. Call next: serial ${next.serialNo}.`,
      action: { kind: 'call_next', label: `Call serial ${next.serialNo}`, appointmentId: next.id, expectedCurrent: null },
    });
  }

  if (state !== 'ended') {
    for (const a of order.notArrived) {
      const late = minutesBetween(a.bookedAt, now);
      if (late > s.noShowMin) {
        add({
          key: `no_show:${a.id}`, type: 'no_show', severity: 'warning',
          message: `Serial ${a.serialNo} is ${Math.round(late)} min past their slot and hasn't arrived. Mark as no-show?`,
          action: { kind: 'no_show', label: `Mark serial ${a.serialNo} no-show`, appointmentId: a.id },
        });
      } else if (late > s.graceMin) {
        add({
          key: `skip:${a.id}`, type: 'skip', severity: 'info',
          message: `Serial ${a.serialNo} hasn't arrived (${Math.round(late)} min past their slot). Skip for now?`,
          action: { kind: 'skip', label: `Skip serial ${a.serialNo}`, appointmentId: a.id },
        });
      }
    }
    // Skipped and still absent: offer no-show once the no-show threshold passes.
    for (const a of order.skipped) {
      if (a.status === 'scheduled' && minutesBetween(a.bookedAt, now) > s.noShowMin) {
        add({
          key: `no_show:${a.id}`, type: 'no_show', severity: 'warning',
          message: `Serial ${a.serialNo} was skipped and still hasn't arrived. Mark as no-show?`,
          action: { kind: 'no_show', label: `Mark serial ${a.serialNo} no-show`, appointmentId: a.id },
        });
      }
    }
  }

  // Doctor is far behind: offer to tell everyone still to be seen (once per 10 extra minutes).
  const toTell = order.line.length + order.notArrived.length;
  const delay = result.summary.delayMin;
  if (state !== 'ended' && toTell > 0 && delay >= s.doctorLateAlertMin &&
      (!input.lastBroadcast || delay >= input.lastBroadcast.minutes + 10)) {
    const minutes = round5(delay);
    add({
      key: `delay:${Math.floor(delay / 10) * 10}`, type: 'notify_delay', severity: 'urgent',
      message: `Doctor is about ${minutes} min behind. Notify ${toTell} waiting patient(s) of revised times?`,
      action: { kind: 'broadcast_delay', label: `Notify ${toTell} patient(s)`, minutes },
    });
  }

  // Nobody waiting and a free gap is coming: room for a walk-in.
  if (state === 'active' && order.line.length === 0) {
    const freeAt = now + result.doctorFreeInMin * MIN;
    const nextBooked = order.notArrived.find((a) => a.bookedAt > now);
    const gapEnd = nextBooked?.bookedAt ?? input.session.scheduledEndAt ?? null;
    const gap = gapEnd != null ? minutesBetween(freeAt, gapEnd) : Infinity;
    if (gap >= result.durations.new.typical) {
      add({
        key: `walk_in:${nextBooked?.id ?? 'open'}`, type: 'accept_walk_in', severity: 'info',
        message: Number.isFinite(gap)
          ? `Nobody is waiting. You can accept a walk-in now (about ${Math.round(gap)} min free).`
          : 'Nobody is waiting. You can accept a walk-in now.',
        action: { kind: 'open_walk_in', label: 'Add walk-in' },
      });
    }
  }

  // A patient's expected wait grew a lot since they checked in.
  for (const id of result.line) {
    const first = input.checkinEtaAt?.[id];
    const e = result.estimates[id];
    if (first != null && e.expectedStartAt != null) {
      const grew = minutesBetween(first, e.expectedStartAt);
      if (grew >= s.lateBandMin) {
        add({
          key: `check_on:${id}:${Math.floor(grew / 15)}`, type: 'check_on', severity: 'warning',
          message: `Serial ${e.serialNo}'s wait grew by ${Math.round(grew)} min since check-in. Check on them.`,
          action: { kind: 'acknowledge', label: 'Done, checked', appointmentId: id },
        });
      }
    }
  }

  // Session paused for a long time.
  if (state === 'paused' && result.session.pausedSinceAt != null) {
    const paused = minutesBetween(result.session.pausedSinceAt, now);
    if (paused >= s.doctorLateAlertMin) {
      add({
        key: `long_pause:${result.session.pausedSinceAt}`, type: 'long_pause', severity: 'warning',
        message: `Session paused for ${Math.round(paused)} min. Resume, or notify waiting patients.`,
        action: { kind: 'resume', label: 'Resume session' },
      });
    }
  }

  // Session ended with patients not resolved.
  const unresolved = order.line.length + order.notArrived.length + order.skipped.length;
  if (state === 'ended' && unresolved > 0) {
    add({
      key: 'resolve_remaining', type: 'resolve_remaining', severity: 'urgent',
      message: `Session ended with ${unresolved} patient(s) not seen. Mark them as no-show or ask them to rebook.`,
      action: { kind: 'resolve_remaining', label: `Mark ${unresolved} as no-show` },
    });
  }

  const dismissed = new Set(input.dismissed ?? []);
  return out
    .filter((x) => !dismissed.has(x.key))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
