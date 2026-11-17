// Discrete-event simulation of one hospital day: doctor chambers, lab sample-collection lines and same-day report reviews.
// The simulator drives the same engine the web app uses, and records what every ETA policy would have told each patient.
import type { DssSettings, PriorityLevel, QueueAppointment, SessionInfo, VisitType } from '../engine/types';
import { DEFAULT_SETTINGS } from '../engine/types';
import { computeQueueOrder } from '../engine/order';
import { computeEstimates } from '../engine/estimates';
import { MIN } from '../engine/time';
import type { LabItem } from '../lab/types';
import { computeLineEstimates, expectedWaitMin } from '../lab/line';
import { adviseReturn } from '../lab/returnAdvice';
import type { FlowActivity, FlowEvent, FlowObjectRef } from '../log/events';
import { makeRng, type Rng } from './rng';
import type { Scenario } from './scenario';
import { ETA_POLICIES, chooseNextLine, type EtaPolicy, type RoutePolicy } from './policies';

export interface Prediction {
  visitId: string;
  policy: EtaPolicy;
  stage: 'doctor' | 'lab';
  /** Doctor id or lab line id. */
  serverId: string;
  madeAt: number;
  predictedAt: number;
  low: number | null;
  high: number | null;
  actualStartAt: number | null;
}

export interface SimDay {
  events: FlowEvent[];
  predictions: Prediction[];
  stats: { doctorIdleMin: Record<string, number>; lineIdleMin: Record<string, number> };
}

// ---------- internal state ----------

interface Doctor {
  id: string; slotMin: number;
  session: SessionInfo;
  appts: QueueAppointment[];
  truth: Map<string, { patientId: string; durationMin: number }>;
  current: string | null;
  history: Record<VisitType, number[]>;
  pendingPause: { min: number } | null;
  busyMin: number;
}
interface Line {
  id: string; name: string; typicalMin: number; cv: number; mustFirst: boolean; turnaroundMin: number; turnaroundCv: number;
  items: LabItem[]; current: string | null; history: number[]; busyMin: number; firstAt: number | null; lastAt: number | null;
}
interface LabVisit {
  patientId: string; doctorId: string | null; remaining: string[]; orderIds: Record<string, string>; reportsDue: number; lastReportAt: number;
}

type Ev =
  | { kind: 'doctor_start'; doctor: string }
  | { kind: 'doctor_tick'; doctor: string }
  | { kind: 'pause'; doctor: string; min: number }
  | { kind: 'resume'; doctor: string }
  | { kind: 'arrive'; doctor: string; appt: string }
  | { kind: 'no_show_check'; doctor: string; appt: string }
  | { kind: 'consult_end'; doctor: string; appt: string }
  | { kind: 'lab_enter'; visit: string }
  | { kind: 'lab_arrive'; visit: string; line: string }
  | { kind: 'lab_done'; line: string; item: string }
  | { kind: 'report_ready'; visit: string; line: string }
  | { kind: 'return_arrive'; visit: string };

class Heap {
  private xs: { t: number; seq: number; ev: Ev }[] = [];
  private seq = 0;
  get size() { return this.xs.length; }
  push(t: number, ev: Ev) {
    const x = { t, seq: this.seq++, ev };
    const a = this.xs; a.push(x);
    for (let i = a.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (this.less(a[p], a[i])) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.xs; const top = a[0]; const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
  private less(x: { t: number; seq: number }, y: { t: number; seq: number }) { return x.t < y.t || (x.t === y.t && x.seq < y.seq); }
}

/** 'HH:MM' Dhaka wall clock on the scenario day → epoch ms. */
export function dhakaClock(date: string, hhmm: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh - 6, mm);
}

/** Recent collections used for a lab line's duration estimate (doctors keep the DSS rule of 30). */
export const LAB_HISTORY_WINDOW = 200;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Simulates one day. Same scenario + seed + route policy ⇒ identical output.
 * Every ETA policy is evaluated on the same day, so policies are compared on identical patients.
 */
export function simulateDay(sc: Scenario, seed: number, p: { route: RoutePolicy }, base: DssSettings = DEFAULT_SETTINGS): SimDay {
  // Doctor queues use the scenario's engine settings on top of the base (DSS) settings.
  const settings: DssSettings = { ...base, ...sc.engine.doctor };
  const rng: Rng = makeRng(seed);
  // Routing draws use their own stream, so route policies see the same patients.
  const routeRng: Rng = makeRng((seed ^ 0x9e3779b9) >>> 0);
  const heap = new Heap();
  const events: FlowEvent[] = [];
  const predictions: Prediction[] = [];
  const pending = new Map<string, Prediction[]>(); // visitId -> predictions waiting for the actual start
  let evSeq = 0, patSeq = 0, apptSeq = 0, itemSeq = 0, orderSeq = 0, visitSeq = 0;
  const clock = (hhmm: string) => dhakaClock(sc.day.date, hhmm);

  const emit = (activity: FlowActivity, time: number, objects: FlowObjectRef[], attrs: FlowEvent['attrs'] = {}) =>
    events.push({ id: `e${++evSeq}`, activity, time, objects, attrs });

  // ----- doctors -----
  const doctors = new Map<string, Doctor>();
  for (const d of sc.doctors) {
    const start = clock(d.sessionStart), end = clock(d.sessionEnd);
    const hist = (median: number) => Array.from({ length: 30 }, () => Math.round(rng.lognormalMin(median, sc.visits.cv) * 10) / 10);
    const doc: Doctor = {
      id: d.id, slotMin: d.slotMin, current: null, truth: new Map(), appts: [], pendingPause: null, busyMin: 0,
      session: { state: 'not_started', scheduledStartAt: start, scheduledEndAt: end, startedAt: null, endedAt: null, pauses: [] },
      history: { new: hist(sc.visits.newMedianMin), follow_up: hist(sc.visits.followUpMedianMin) },
    };
    doctors.set(d.id, doc);
    const late = Math.max(0, rng.normal(d.startLateMeanMin, d.startLateSdMin));
    heap.push(start + Math.round(late * MIN), { kind: 'doctor_start', doctor: d.id });
    heap.push(end, { kind: 'doctor_tick', doctor: d.id });
    if (d.pause) heap.push(clock(d.pause.at), { kind: 'pause', doctor: d.id, min: d.pause.min });

    for (let k = 0; k < d.bookedCount; k++) {
      const slot = start + k * d.slotMin * MIN;
      if (slot >= end) break;
      const id = `a${++apptSeq}`, patientId = `p${++patSeq}`;
      const visitType: VisitType = rng.bernoulli(sc.visits.followUpShare) ? 'follow_up' : 'new';
      doc.appts.push({ id, serialNo: k + 1, status: 'scheduled', bookedAt: slot, slotMinutes: d.slotMin, priorityLevel: 0, visitType, visitSource: 'online' });
      doc.truth.set(id, { patientId, durationMin: drawVisit(visitType, false) });
      emit('book', slot - 6 * 60 * MIN, [{ type: 'patient', id: patientId }, { type: 'appointment', id }, { type: 'doctor', id: d.id }], { role: 'patient', bookedAt: slot });
      if (rng.bernoulli(sc.patients.noShowP)) {
        heap.push(slot + settings.noShowMin * MIN, { kind: 'no_show_check', doctor: d.id, appt: id });
      } else {
        const arr = slot + Math.round(rng.normal(sc.patients.latenessMeanMin, sc.patients.latenessSdMin) * MIN);
        if (arr - slot > settings.noShowMin * MIN) heap.push(slot + settings.noShowMin * MIN, { kind: 'no_show_check', doctor: d.id, appt: id });
        else heap.push(arr, { kind: 'arrive', doctor: d.id, appt: id });
      }
    }
    for (const t of rng.poissonTimes(sc.patients.walkInPerHour, start, end - 30 * MIN)) {
      const id = `a${++apptSeq}`, patientId = `p${++patSeq}`;
      const priority: PriorityLevel = rng.bernoulli(sc.patients.emergencyShareOfWalkIns) ? 2 : 0;
      doc.appts.push({ id, serialNo: 0, status: 'hold', bookedAt: t, slotMinutes: d.slotMin, priorityLevel: priority, visitType: 'new', visitSource: 'walk_in' });
      doc.truth.set(id, { patientId, durationMin: drawVisit('new', false) });
      heap.push(t, { kind: 'arrive', doctor: d.id, appt: id });
    }
  }

  function drawVisit(type: VisitType, review: boolean): number {
    if (review) return rng.lognormalMin(settings.reportReviewMin, sc.visits.cv);
    return rng.lognormalMin(type === 'new' ? sc.visits.newMedianMin : sc.visits.followUpMedianMin, sc.visits.cv);
  }

  // ----- lab lines -----
  const lines = new Map<string, Line>();
  for (const l of sc.lab.lines) {
    lines.set(l.id, {
      ...l, items: [], current: null, busyMin: 0, firstAt: null, lastAt: null,
      history: Array.from({ length: 20 }, () => Math.round(rng.lognormalMin(l.typicalMin, l.cv) * 10) / 10),
    });
  }
  const labOpen = clock(sc.lab.open), labClose = clock(sc.lab.close);
  // A counter stays open past closing time until everyone already in its line is served.
  const labSession = (line: Line, now: number): SessionInfo => ({
    state: now < labOpen ? 'not_started'
      : now < labClose || line.items.some((x) => x.status === 'queued' || x.status === 'called') ? 'active' : 'ended',
    scheduledStartAt: labOpen, scheduledEndAt: labClose, startedAt: labOpen, pauses: [],
  });
  // Lab lines see many patients a day, so their duration estimate may use a longer history than a doctor's 30 visits.
  // Long lines add up many visits, so they sum averages rather than medians.
  const labSettings: DssSettings = { ...base, historyWindow: LAB_HISTORY_WINDOW, sumWith: 'mean', ...sc.engine.lab };
  const visits = new Map<string, LabVisit>();
  const lineIds = sc.lab.lines.map((l) => l.id);
  const shares = sc.lab.lines.map((l) => l.share);
  const drawTests = () => {
    const n = rng.int(sc.lab.testsPerOrder[0], sc.lab.testsPerOrder[1]);
    return [...new Set(Array.from({ length: n }, () => lineIds[rng.weighted(shares)]))];
  };

  // Outside patients come only for tests. Window: an hour before the first chamber until the last chamber closes.
  const winFrom = Math.min(...sc.doctors.map((d) => clock(d.sessionStart))) - 60 * MIN;
  const winTo = Math.max(...sc.doctors.map((d) => clock(d.sessionEnd)));
  for (const t of rng.poissonTimes(sc.lab.outsidePerHour, Math.max(winFrom, labOpen), Math.min(winTo, labClose))) {
    const vid = startLabVisit(`p${++patSeq}`, null, drawTests(), t, true);
    heap.push(t, { kind: 'lab_enter', visit: vid });
  }

  function startLabVisit(patientId: string, doctorId: string | null, tests: string[], t: number, outside: boolean) {
    const vid = `v${++visitSeq}`;
    const orderIds: Record<string, string> = {};
    for (const line of tests) orderIds[line] = `o${++orderSeq}`;
    visits.set(vid, { patientId, doctorId, remaining: [...tests], orderIds, reportsDue: tests.length, lastReportAt: 0 });
    emit('lab_order', t, [{ type: 'patient', id: patientId }, ...tests.map((l) => ({ type: 'lab_order' as const, id: orderIds[l] })),
      ...(doctorId ? [{ type: 'doctor' as const, id: doctorId }] : [])], { role: outside ? 'lab_staff' : 'doctor', outside, tests: tests.join(',') });
    return vid;
  }

  // ----- snapshots and predictions -----
  const doctorSnapshot = (doc: Doctor, now: number) =>
    computeEstimates({ now, settings, session: doc.session, appointments: doc.appts, history: doc.history, slotMinutes: doc.slotMin });
  const lineSnapshot = (line: Line, now: number) =>
    computeLineEstimates({ now, settings: labSettings, session: labSession(line, now), line, items: line.items, history: line.history });

  function predictDoctor(doc: Doctor, a: QueueAppointment, now: number) {
    const r = doctorSnapshot(doc, now);
    const e = r.estimates[a.id];
    const ahead = e?.patientsAhead ?? 0;
    const startFrom = doc.session.state === 'not_started' ? Math.max(now, doc.session.scheduledStartAt ?? now) : now;
    const busy = doc.current ? 1 : 0;
    const today = doc.appts.filter((x) => x.consultStartedAt != null && x.consultEndedAt != null)
      .map((x) => (x.consultEndedAt! - x.consultStartedAt!) / MIN);
    const per = mean(today) ?? doc.slotMin;
    // history_mean: the engine's own history, simple rule (one mean per visit type, no elapsed-time credit).
    const hMean = (x: QueueAppointment) => (x.visitReason === 'report_review' ? settings.reportReviewMin
      : mean(doc.history[x.visitType].slice(0, settings.historyWindow)) ?? doc.slotMin);
    const aheadIds = r.line.slice(0, ahead);
    const histSum = aheadIds.reduce((m, id) => m + hMean(doc.appts.find((x) => x.id === id)!), 0)
      + (doc.current ? hMean(doc.appts.find((x) => x.id === doc.current)!) : 0);
    const values: Partial<Record<EtaPolicy, [number, number | null, number | null]>> = {
      engine: [e?.expectedStartAt ?? now, e?.lowAt ?? null, e?.highAt ?? null],
      booked: [a.visitSource === 'online' ? Math.max(a.bookedAt, now) : now, null, null],
      position_slot: [startFrom + (ahead + busy) * doc.slotMin * MIN, null, null],
      running_mean: [startFrom + (ahead + busy) * per * MIN, null, null],
      history_mean: [startFrom + histSum * MIN, null, null],
    };
    record(a.id, 'doctor', doc.id, now, values);
  }

  function predictLab(line: Line, item: LabItem, now: number) {
    const r = lineSnapshot(line, now);
    const e = r.estimates[item.id];
    const ahead = e?.patientsAhead ?? 0;
    const busy = line.current ? 1 : 0;
    const today = line.items.filter((x) => x.status === 'collected' && x.calledAt != null && x.collectedAt != null)
      .map((x) => (x.collectedAt! - x.calledAt!) / MIN);
    const per = mean(today) ?? line.typicalMin;
    const hPer = mean(line.history.slice(0, labSettings.historyWindow)) ?? line.typicalMin;
    const values: Partial<Record<EtaPolicy, [number, number | null, number | null]>> = {
      engine: [e?.expectedStartAt ?? now, e?.lowAt ?? null, e?.highAt ?? null],
      position_slot: [now + (ahead + busy) * line.typicalMin * MIN, null, null],
      running_mean: [now + (ahead + busy) * per * MIN, null, null],
      history_mean: [now + (ahead + busy) * hPer * MIN, null, null],
    };
    record(item.id, 'lab', line.id, now, values);
  }

  function record(visitId: string, stage: 'doctor' | 'lab', serverId: string, now: number, v: Partial<Record<EtaPolicy, [number, number | null, number | null]>>) {
    const list = ETA_POLICIES.filter((policy) => v[policy]).map((policy) => ({
      visitId, policy, stage, serverId, madeAt: now, predictedAt: v[policy]![0], low: v[policy]![1], high: v[policy]![2], actualStartAt: null,
    }) as Prediction);
    predictions.push(...list);
    pending.set(visitId, list);
  }
  const started = (visitId: string, at: number) => {
    for (const x of pending.get(visitId) ?? []) x.actualStartAt = at;
    pending.delete(visitId);
  };

  // ----- dispatch: every idle server takes the next person -----
  const docRefs = (doc: Doctor, a: QueueAppointment): FlowObjectRef[] => [
    { type: 'patient', id: doc.truth.get(a.id)!.patientId }, { type: 'appointment', id: a.id }, { type: 'doctor', id: doc.id },
    { type: 'doctor_session', id: `${doc.id}-${sc.day.date}` },
  ];

  function dispatchDoctor(doc: Doctor, now: number) {
    if (doc.current || doc.session.state !== 'active') return;
    const next = computeQueueOrder(doc.appts, settings).line[0];
    if (!next) { maybeEnd(doc, now); return; }
    next.status = 'in_consultation'; next.calledAt = now; next.consultStartedAt = now;
    doc.current = next.id;
    started(next.id, now);
    const refs = docRefs(doc, next);
    emit('call', now, refs, { role: 'compounder' });
    emit('consult_start', now, refs, { role: 'doctor', priority: next.priorityLevel, review: next.visitReason === 'report_review' });
    heap.push(now + Math.round(doc.truth.get(next.id)!.durationMin * MIN), { kind: 'consult_end', doctor: doc.id, appt: next.id });
  }

  function maybeEnd(doc: Doctor, now: number) {
    if (doc.session.state !== 'active' || doc.current || now < (doc.session.scheduledEndAt ?? Infinity)) return;
    if (computeQueueOrder(doc.appts, settings).line.length) return;
    doc.session.state = 'ended'; doc.session.endedAt = now;
    emit('session_end', now, [{ type: 'doctor', id: doc.id }, { type: 'doctor_session', id: `${doc.id}-${sc.day.date}` }], { role: 'doctor' });
    for (const a of doc.appts) {
      if (a.status === 'scheduled') {
        a.status = 'no_show';
        emit('no_show', now, docRefs(doc, a), { role: 'compounder', reason: 'session_end' });
      }
    }
  }

  function dispatchLine(line: Line, now: number) {
    // Patients already in line when the lab closes are still served; no new day starts before opening.
    if (line.current || now < labOpen) return;
    const next = line.items.filter((x) => x.status === 'queued')
      .sort((a, b) => b.priorityLevel - a.priorityLevel || a.queuedAt - b.queuedAt || a.id.localeCompare(b.id))[0];
    if (!next) return;
    next.status = 'called'; next.calledAt = now; line.current = next.id;
    started(next.id, now);
    const visit = visits.get(itemVisit.get(next.id)!)!;
    emit('lab_call', now, [{ type: 'patient', id: visit.patientId }, { type: 'lab_queue_item', id: next.id }, { type: 'lab_line', id: line.id }], { role: 'lab_staff' });
    heap.push(now + Math.round(rng.lognormalMin(line.typicalMin, line.cv) * MIN), { kind: 'lab_done', line: line.id, item: next.id });
  }

  const itemVisit = new Map<string, string>();
  function enqueueLab(vid: string, lineId: string, now: number) {
    const line = lines.get(lineId)!;
    const visit = visits.get(vid)!;
    const item: LabItem = { id: `q${++itemSeq}`, lineId, patientId: visit.patientId, queuedAt: now, status: 'queued', priorityLevel: 0 };
    itemVisit.set(item.id, vid);
    line.items.push(item);
    predictLab(line, item, now);
    line.firstAt ??= now;
    emit('lab_queue', now, [{ type: 'patient', id: visit.patientId }, { type: 'lab_queue_item', id: item.id }, { type: 'lab_line', id: lineId },
      { type: 'lab_order', id: visit.orderIds[lineId] }], { role: 'lab_staff' });
  }

  function nextLine(vid: string, now: number): string | null {
    const v = visits.get(vid)!;
    if (!v.remaining.length) return null;
    const waits: Record<string, number> = {};
    for (const id of v.remaining) waits[id] = expectedWaitMin(lineSnapshot(lines.get(id)!, now), labSettings);
    const queuedNow: Record<string, number> = {};
    for (const id of v.remaining) queuedNow[id] = lines.get(id)!.items.filter((x) => x.status === 'queued').length;
    const pick = chooseNextLine(p.route, v.remaining.map((id) => ({ lineId: id, mustFirst: lines.get(id)!.mustFirst })), waits, queuedNow, lineIds, routeRng);
    v.remaining = v.remaining.filter((x) => x !== pick);
    return pick;
  }

  // ----- event loop -----
  let guard = 0;
  while (heap.size) {
    if (++guard > 500_000) throw new Error('simulateDay: event limit reached');
    const { t: now, ev } = heap.pop();
    switch (ev.kind) {
      case 'doctor_start': {
        const doc = doctors.get(ev.doctor)!;
        doc.session.state = 'active'; doc.session.startedAt = now;
        emit('session_start', now, [{ type: 'doctor', id: doc.id }, { type: 'doctor_session', id: `${doc.id}-${sc.day.date}` }], { role: 'doctor' });
        break;
      }
      case 'doctor_tick': maybeEnd(doctors.get(ev.doctor)!, now); break;
      case 'pause': {
        const doc = doctors.get(ev.doctor)!;
        if (doc.session.state === 'not_started' || doc.session.state === 'ended') break;
        if (doc.current) { doc.pendingPause = { min: ev.min }; break; }
        startPause(doc, ev.min, now);
        break;
      }
      case 'resume': {
        const doc = doctors.get(ev.doctor)!;
        const open = doc.session.pauses.find((x) => x.resumedAt == null);
        if (open) open.resumedAt = now;
        doc.session.state = 'active';
        emit('session_resume', now, [{ type: 'doctor', id: doc.id }, { type: 'doctor_session', id: `${doc.id}-${sc.day.date}` }], { role: 'doctor' });
        break;
      }
      case 'arrive': {
        const doc = doctors.get(ev.doctor)!;
        const a = doc.appts.find((x) => x.id === ev.appt)!;
        if (doc.session.state === 'ended' || a.status !== 'scheduled' && a.status !== 'hold') break;
        a.checkedInAt = now;
        if (a.status === 'hold') {
          a.status = 'checked_in'; a.bookedAt = now;
          a.serialNo = Math.max(0, ...doc.appts.map((x) => x.serialNo)) + 1;
          emit('walk_in', now, docRefs(doc, a), { role: 'compounder', priority: a.priorityLevel, review: a.visitReason === 'report_review' });
        } else {
          a.status = 'checked_in';
          emit('check_in', now, docRefs(doc, a), { role: 'compounder' });
        }
        predictDoctor(doc, a, now);
        break;
      }
      case 'no_show_check': {
        const doc = doctors.get(ev.doctor)!;
        const a = doc.appts.find((x) => x.id === ev.appt)!;
        if (a.status !== 'scheduled') break;
        a.status = 'no_show';
        emit('no_show', now, docRefs(doc, a), { role: 'compounder' });
        break;
      }
      case 'consult_end': {
        const doc = doctors.get(ev.doctor)!;
        const a = doc.appts.find((x) => x.id === ev.appt)!;
        a.status = 'completed'; a.consultEndedAt = now; doc.current = null;
        doc.busyMin += (now - a.consultStartedAt!) / MIN;
        // Like the app: finished visits feed the doctor's history (report reviews have their own fixed length).
        if (a.visitReason !== 'report_review') doc.history[a.visitType].unshift((now - a.consultStartedAt!) / MIN);
        emit('consult_end', now, docRefs(doc, a), { role: 'doctor' });
        const patientId = doc.truth.get(a.id)!.patientId;
        if (a.visitReason !== 'report_review' && rng.bernoulli(sc.lab.orderP)) {
          const vid = startLabVisit(patientId, doc.id, drawTests(), now, false);
          if (rng.bernoulli(sc.lab.nowP)) heap.push(now, { kind: 'lab_enter', visit: vid });
        }
        if (doc.pendingPause) { startPause(doc, doc.pendingPause.min, now); doc.pendingPause = null; }
        break;
      }
      case 'lab_enter': {
        const first = nextLine(ev.visit, now);
        if (first) enqueueLab(ev.visit, first, now);
        break;
      }
      case 'lab_arrive': enqueueLab(ev.visit, ev.line, now); break;
      case 'lab_done': {
        const line = lines.get(ev.line)!;
        const item = line.items.find((x) => x.id === ev.item)!;
        item.status = 'collected'; item.collectedAt = now; line.current = null;
        line.busyMin += (now - item.calledAt!) / MIN; line.lastAt = now;
        line.history.unshift((now - item.calledAt!) / MIN);
        const vid = itemVisit.get(item.id)!;
        const visit = visits.get(vid)!;
        emit('sample_collected', now, [{ type: 'patient', id: visit.patientId }, { type: 'lab_queue_item', id: item.id }, { type: 'lab_line', id: line.id },
          { type: 'lab_order', id: visit.orderIds[line.id] }], { role: 'lab_staff' });
        const tat = line.turnaroundMin > 0 ? rng.lognormalMin(line.turnaroundMin, line.turnaroundCv) : 0;
        heap.push(now + Math.round(tat * MIN), { kind: 'report_ready', visit: vid, line: line.id });
        const nxt = nextLine(vid, now);
        if (nxt) heap.push(now, { kind: 'lab_arrive', visit: vid, line: nxt });
        break;
      }
      case 'report_ready': {
        const visit = visits.get(ev.visit)!;
        emit('report_ready', now, [{ type: 'patient', id: visit.patientId }, { type: 'lab_order', id: visit.orderIds[ev.line] }, { type: 'lab_line', id: ev.line }], { role: 'lab_staff' });
        visit.reportsDue -= 1; visit.lastReportAt = now;
        if (visit.reportsDue > 0 || !visit.doctorId || visit.remaining.length) break;
        const doc = doctors.get(visit.doctorId)!;
        const snap = doctorSnapshot(doc, now);
        const wait = doc.session.state === 'ended' ? 0 : snap.doctorFreeInMin + snap.line.reduce((m, id) => {
          const a = doc.appts.find((x) => x.id === id)!;
          return m + (a.visitReason === 'report_review' ? settings.reportReviewMin : snap.durations[a.visitType].typical);
        }, 0);
        const advice = adviseReturn({ reportReadyAt: now, doctorSession: doc.session, queueWaitMin: wait, travelBufferMin: sc.returns.travelBufferMin });
        if (advice.kind === 'same_day' && rng.bernoulli(sc.returns.sameDayWillingP)) {
          heap.push(now + sc.returns.travelBufferMin * MIN, { kind: 'return_arrive', visit: ev.visit });
        }
        break;
      }
      case 'return_arrive': {
        const visit = visits.get(ev.visit)!;
        const doc = doctors.get(visit.doctorId!)!;
        if (doc.session.state === 'ended') break;
        const id = `a${++apptSeq}`;
        const a: QueueAppointment = {
          id, serialNo: Math.max(0, ...doc.appts.map((x) => x.serialNo)) + 1, status: 'checked_in', bookedAt: now, checkedInAt: now,
          slotMinutes: doc.slotMin, priorityLevel: 0, visitType: 'follow_up', visitReason: 'report_review', visitSource: 'walk_in',
        };
        doc.appts.push(a);
        doc.truth.set(id, { patientId: visit.patientId, durationMin: drawVisit('follow_up', true) });
        emit('return_queue', now, docRefs(doc, a), { role: 'compounder', review: true });
        predictDoctor(doc, a, now);
        break;
      }
    }
    for (const doc of doctors.values()) dispatchDoctor(doc, now);
    for (const line of lines.values()) dispatchLine(line, now);
  }

  function startPause(doc: Doctor, min: number, now: number) {
    doc.session.state = 'paused';
    doc.session.pauses.push({ pausedAt: now, resumedAt: null, reason: 'break' });
    emit('session_pause', now, [{ type: 'doctor', id: doc.id }, { type: 'doctor_session', id: `${doc.id}-${sc.day.date}` }], { role: 'doctor' });
    heap.push(now + min * MIN, { kind: 'resume', doctor: doc.id });
  }

  // ----- idle time -----
  const doctorIdleMin: Record<string, number> = {};
  for (const doc of doctors.values()) {
    const s = doc.session;
    if (s.startedAt == null) { doctorIdleMin[doc.id] = 0; continue; }
    const end = s.endedAt ?? s.startedAt;
    const paused = s.pauses.reduce((m, x) => m + ((x.resumedAt ?? end) - x.pausedAt) / MIN, 0);
    doctorIdleMin[doc.id] = Math.max(0, (end - s.startedAt) / MIN - paused - doc.busyMin);
  }
  const lineIdleMin: Record<string, number> = {};
  for (const line of lines.values()) {
    lineIdleMin[line.id] = line.firstAt == null || line.lastAt == null ? 0 : Math.max(0, (line.lastAt - line.firstAt) / MIN - line.busyMin);
  }

  events.sort((a, b) => a.time - b.time || Number(a.id.slice(1)) - Number(b.id.slice(1)));
  return { events, predictions, stats: { doctorIdleMin, lineIdleMin } };
}
