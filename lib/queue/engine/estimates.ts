import type {
  Confidence, DssSettings, Durations, EngineInput, Flag, NowServing, PatientEstimate, QueueAppointment, QueueResult,
  Stage, StatusLabel,
} from './types';
import { computeQueueOrder, countedTime, compareLine } from './order';
import { computeExpectedDurations } from './durations';
import { activeMinutes, MIN, minutesBetween, round5 } from './time';

/** B6: compare expected (or real) start with the booked time. Boundaries are inclusive towards "on time"/"running late". */
export function statusLabel(deltaMin: number, s: Pick<DssSettings, 'onTimeBandMin' | 'lateBandMin'>): StatusLabel {
  if (Math.abs(deltaMin) <= s.onTimeBandMin) return 'on_time';
  if (deltaMin < 0) return 'early';
  if (deltaMin <= s.lateBandMin) return 'running_late';
  return 'delayed';
}

/** B5 confidence. */
export function confidence(samples: number, ahead: number, s: Pick<DssSettings, 'minDurationSamples'>): Confidence {
  if (samples < s.minDurationSamples || ahead > 8) return 'low';
  if (samples >= 20 && ahead <= 3) return 'high';
  return 'medium';
}

function stageOf(a: QueueAppointment): Stage {
  switch (a.status) {
    case 'scheduled': return a.skippedAt != null ? 'skipped' : 'not_arrived';
    case 'checked_in': return a.skippedAt != null ? 'skipped' : 'waiting';
    case 'in_consultation': return 'in_room';
    case 'prescription_pending':
    case 'completed': return 'done';
    case 'no_show': return 'no_show';
    default: return 'cancelled';
  }
}

const REASONS: Partial<Record<Flag, string>> = {
  session_ended: 'The session has ended',
  doctor_paused: 'Doctor is on a short break',
  doctor_not_started: "Doctor hasn't started yet",
  doctor_late_start: 'Doctor started late',
  consult_overrun: 'The current visit is taking longer than usual',
  visits_longer: 'Visits today are taking longer than usual',
  emergency_ahead: 'An urgent patient is being seen first',
  not_arrived_ahead_may_come: 'Estimates can change if booked patients arrive',
};
const REASON_ORDER: Flag[] = [
  'session_ended', 'doctor_paused', 'doctor_not_started', 'doctor_late_start', 'emergency_ahead',
  'consult_overrun', 'visits_longer', 'not_arrived_ahead_may_come',
];

/** One plain sentence for the patient explaining the estimate (no medical or other-patient data). */
export function reasonText(flags: Flag[], lateStartMin: number, label: StatusLabel | null): string {
  const top = REASON_ORDER.find((f) => flags.includes(f));
  if (top === 'doctor_late_start') return `Doctor started ${Math.round(lateStartMin)} minutes late`;
  if (top) return REASONS[top]!;
  if (label === 'early') return 'The queue is moving faster than booked';
  if (label === 'running_late' || label === 'delayed') return 'Patients ahead of you are still being seen';
  return 'The queue is running on time';
}

/**
 * B5 + B6: expected start, range, patients ahead, confidence and label for every appointment of the day.
 * expected start = start point + time until the doctor is free + typical durations of the checked-in patients ahead.
 */
export function computeEstimates(input: EngineInput): QueueResult {
  const { now, settings: s, session } = input;
  const durations: Durations = computeExpectedDurations({
    history: input.history, departmentAvgMin: input.departmentAvgMin, slotMinutes: input.slotMinutes, settings: s,
  });
  const order = computeQueueOrder(input.appointments, s);
  const pauses = session.pauses ?? [];
  const openPause = pauses.find((p) => p.resumedAt == null) ?? null;

  // B7: where the doctor's time starts from.
  const lateStartMin =
    session.startedAt != null && session.scheduledStartAt != null
      ? Math.max(0, minutesBetween(session.scheduledStartAt, session.startedAt))
      : 0;
  const t0 = session.state === 'not_started' ? Math.max(now, session.scheduledStartAt ?? now) : now;

  // Time until the doctor is free (typical / short / long).
  let nowServing: NowServing | null = null;
  let freeTyp = 0, freeLow = 0, freeHigh = 0;
  if (order.current?.consultStartedAt != null) {
    const d = durations[order.current.visitType];
    const elapsed = activeMinutes(order.current.consultStartedAt, now, pauses, now);
    freeTyp = elapsed < d.typical ? d.typical - elapsed : 2; // running over: assume 2 more minutes
    freeLow = Math.min(freeTyp, Math.max(0, d.short - elapsed));
    freeHigh = Math.max(freeTyp, d.long - elapsed);
    nowServing = {
      appointmentId: order.current.id, serialNo: order.current.serialNo, startedAt: order.current.consultStartedAt,
      elapsedMin: elapsed, expectedMin: d.typical, overrun: elapsed > d.typical,
    };
  }

  // Today's real visit lengths, for "visits are taking longer than usual".
  const todays = order.done
    .filter((a) => a.consultStartedAt != null && a.consultEndedAt != null)
    .map((a) => activeMinutes(a.consultStartedAt!, a.consultEndedAt!, pauses, now));
  const avgVisitMin = todays.length ? todays.reduce((x, y) => x + y, 0) / todays.length : null;
  const visitsLonger = todays.length >= 2 && avgVisitMin! > durations.new.typical * 1.25;

  const baseFlags: Flag[] = [];
  if (session.state === 'not_started') baseFlags.push('doctor_not_started');
  if (session.state === 'paused') baseFlags.push('doctor_paused');
  if (session.state === 'ended') baseFlags.push('session_ended');
  if (lateStartMin > s.onTimeBandMin) baseFlags.push('doctor_late_start');
  if (nowServing?.overrun) baseFlags.push('consult_overrun');
  if (visitsLonger) baseFlags.push('visits_longer');

  const estimates: Record<string, PatientEstimate> = {};
  const blank = (a: QueueAppointment, stage: Stage): PatientEstimate => ({
    appointmentId: a.id, serialNo: a.serialNo, stage, position: null, patientsAhead: null,
    expectedStartAt: null, lowAt: null, highAt: null, waitMinLow: null, waitMinHigh: null,
    confidence: null, label: null, deltaMin: null, flags: [], reason: '',
  });
  const finish = (e: PatientEstimate, flags: Flag[]) => {
    e.flags = flags;
    e.reason = reasonText(flags, lateStartMin, e.label);
    estimates[e.appointmentId] = e;
  };

  // Waiting line.
  let sumTyp = 0, sumLow = 0, sumHigh = 0;
  const ended = session.state === 'ended';
  order.line.forEach((a, i) => {
    const e = blank(a, 'waiting');
    e.position = i + 1;
    e.patientsAhead = i;
    const flags = [...baseFlags];
    if (order.line.slice(0, i).some((x) => x.priorityLevel > a.priorityLevel)) flags.push('emergency_ahead');
    if (order.notArrived.some((x) => countedTime(x, s) < countedTime(a, s))) flags.push('not_arrived_ahead_may_come');
    if (!ended) {
      e.expectedStartAt = t0 + (freeTyp + sumTyp) * MIN;
      e.lowAt = t0 + (freeLow + sumLow) * MIN;
      e.highAt = t0 + (freeHigh + sumHigh) * MIN;
      e.waitMinLow = round5(minutesBetween(now, e.lowAt));
      e.waitMinHigh = Math.max(e.waitMinLow, round5(minutesBetween(now, e.highAt)));
      e.deltaMin = minutesBetween(a.bookedAt, e.expectedStartAt);
      e.label = statusLabel(e.deltaMin, s);
      e.confidence = confidence(durations[a.visitType].samples, i, s);
    }
    const d = durations[a.visitType];
    sumTyp += d.typical; sumLow += d.short; sumHigh += d.long;
    finish(e, flags);
  });

  // Not arrived: "Not arrived" label; the expected start is what it would be if they checked in now.
  for (const a of order.notArrived) {
    const e = blank(a, 'not_arrived');
    e.label = 'not_arrived';
    if (!ended) {
      const probe: QueueAppointment = { ...a, status: 'checked_in', checkedInAt: Math.max(now, a.bookedAt) };
      const ahead = order.line.filter((x) => compareLine(x, probe, s) < 0);
      e.patientsAhead = ahead.length;
      const typ = ahead.reduce((m, x) => m + durations[x.visitType].typical, 0);
      e.expectedStartAt = Math.max(t0 + (freeTyp + typ) * MIN, a.bookedAt);
      e.deltaMin = minutesBetween(a.bookedAt, e.expectedStartAt);
      e.confidence = 'low';
    }
    finish(e, [...baseFlags]);
  }

  // In the room, finished, skipped, no-show: real times where they exist.
  for (const a of input.appointments) {
    if (estimates[a.id]) continue;
    const e = blank(a, stageOf(a));
    if ((e.stage === 'in_room' || e.stage === 'done') && a.consultStartedAt != null) {
      e.expectedStartAt = a.consultStartedAt;
      e.deltaMin = minutesBetween(a.bookedAt, a.consultStartedAt);
      e.label = statusLabel(e.deltaMin, s);
      e.patientsAhead = 0;
    }
    finish(e, e.stage === 'in_room' ? baseFlags.filter((f) => f !== 'consult_overrun') : []);
  }

  // How far behind schedule the doctor is (for the delay alert and the day summary).
  let delayMin = 0;
  if (session.state === 'not_started' && session.scheduledStartAt != null) {
    delayMin = Math.max(0, minutesBetween(session.scheduledStartAt, now));
  } else {
    const onTime = order.line.find((a) => countedTime(a, s) === a.bookedAt);
    if (onTime && estimates[onTime.id].expectedStartAt != null) {
      delayMin = Math.max(0, estimates[onTime.id].deltaMin!);
    } else if (order.current?.consultStartedAt != null && countedTime(order.current, s) === order.current.bookedAt) {
      delayMin = Math.max(0, minutesBetween(order.current.bookedAt, order.current.consultStartedAt));
    }
  }

  return {
    now,
    session: { state: session.state, lateStartMin, pausedSinceAt: openPause?.pausedAt ?? null, pauseReason: openPause?.reason ?? null },
    durations,
    nowServing,
    doctorFreeInMin: freeTyp,
    line: order.line.map((a) => a.id),
    estimates,
    summary: {
      seen: order.done.length,
      inRoom: order.current ? 1 : 0,
      waiting: order.line.length,
      notArrived: order.notArrived.length,
      noShows: order.noShows.length,
      avgVisitMin,
      delayMin: Math.round(delayMin),
    },
  };
}
