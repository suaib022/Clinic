/**
 * DSS-36: replays a scripted clinic evening through the engine, minute by minute, exactly as the compounder
 * would drive it (check-in on arrival, Call next whenever the doctor is free), and prints per patient:
 * booked time, arrival, first estimate after check-in, actual start, and the estimate error.
 *
 * Run: npm run dss:simulate   (pure engine, no database)
 */
import {
  runEngine, DEFAULT_SETTINGS, MIN, activeMinutes,
  type QueueAppointment, type SessionInfo, type Pause, type VisitType,
} from '../lib/queue/engine';

const DAY = Date.UTC(2026, 10, 10, 0, 0); // Dhaka = UTC+6
const t = (h: number, m: number) => DAY + (h - 6) * 60 * MIN + m * MIN;
const fmt = (ms: number | null | undefined) => {
  if (ms == null) return '  -  ';
  const d = new Date(ms + 6 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

interface Script {
  serial: number;
  bookedMin: number | null; // minutes after 18:00; null = walk-in
  arriveMin: number | null; // minutes after 18:00; null = never comes
  visit: number;            // real consult minutes
  type?: VisitType;
  priority?: 0 | 1 | 2;
}
// Dr. Rahman, 6–9 PM, 10-minute slots. Visits ~9 min. Doctor starts 6:05.
const SCRIPT: Script[] = [
  { serial: 1, bookedMin: 0, arriveMin: -10, visit: 8 },
  { serial: 2, bookedMin: 10, arriveMin: 45, visit: 9 },          // late: rejoins by arrival time
  { serial: 3, bookedMin: 20, arriveMin: 12, visit: 11 },
  { serial: 4, bookedMin: 30, arriveMin: 25, visit: 7, type: 'follow_up' },
  { serial: 5, bookedMin: 40, arriveMin: null, visit: 9 },        // no-show
  { serial: 6, bookedMin: 50, arriveMin: 30, visit: 13 },         // early arrival
  { serial: 7, bookedMin: 60, arriveMin: 58, visit: 9 },
  { serial: 8, bookedMin: 70, arriveMin: null, visit: 9 },        // no-show
  { serial: 9, bookedMin: 80, arriveMin: 79, visit: 6, type: 'follow_up' },
  { serial: 10, bookedMin: 90, arriveMin: 85, visit: 10 },
  { serial: 11, bookedMin: null, arriveMin: 52, visit: 8 },       // walk-in
  { serial: 12, bookedMin: null, arriveMin: 66, visit: 15, priority: 2 }, // emergency walk-in
  { serial: 13, bookedMin: 100, arriveMin: 95, visit: 9 },
  { serial: 14, bookedMin: 110, arriveMin: 112, visit: 8 },
];
const PAUSE: Pause = { pausedAt: t(19, 20), resumedAt: t(19, 30), reason: 'Prayer break' };
const START = t(18, 5);
const s = DEFAULT_SETTINGS;

const appts: QueueAppointment[] = SCRIPT.map((x) => ({
  id: `s${x.serial}`, serialNo: x.serial, status: 'scheduled',
  bookedAt: x.bookedMin == null ? Number.NaN : t(18, x.bookedMin), slotMinutes: 10,
  priorityLevel: x.priority ?? 0, visitType: x.type ?? 'new', visitSource: x.bookedMin == null ? 'walk_in' : 'online',
}));
const history: Record<VisitType, number[]> = {
  new: [9, 8, 10, 9, 7, 12, 9, 8, 11, 9, 6, 13, 9, 10, 8, 9, 14, 9, 7, 10],
  follow_up: [6, 5, 7, 6, 8, 5, 6, 7, 6, 5, 6, 7],
};
const firstEta: Record<string, number> = {};
const firstRange: Record<string, [number, number]> = {};
const session: SessionInfo = { state: 'not_started', scheduledStartAt: t(18, 0), scheduledEndAt: t(21, 0), pauses: [] };
const byId = (id: string) => appts.find((a) => a.id === id)!;

for (let now = t(17, 45); now <= t(21, 0); now += MIN) {
  const m = (now - t(18, 0)) / MIN;
  // arrivals (walk-ins are registered at arrival: booked time = arrival)
  for (const x of SCRIPT) {
    const a = byId(`s${x.serial}`);
    if (x.arriveMin === m && a.status === 'scheduled') {
      a.status = 'checked_in';
      a.checkedInAt = now;
      if (Number.isNaN(a.bookedAt)) a.bookedAt = now;
    }
  }
  if (now === START) { session.state = 'active'; session.startedAt = now; }
  if (now === PAUSE.pausedAt) { session.state = 'paused'; session.pauses = [{ pausedAt: now, reason: PAUSE.reason }]; }
  if (now === PAUSE.resumedAt) { session.state = 'active'; session.pauses = [PAUSE]; }

  // the visit in the room ends when its real (active) duration has passed
  const cur = appts.find((a) => a.status === 'in_consultation');
  if (cur && activeMinutes(cur.consultStartedAt!, now, session.pauses, now) >= SCRIPT[cur.serialNo - 1].visit) {
    cur.status = 'completed';
    cur.consultEndedAt = now;
    history[cur.visitType].unshift(activeMinutes(cur.consultStartedAt!, now, session.pauses, now));
  }
  // compounder follows the suggestions: no-show after 30 min, "Call next" when the doctor is free
  const avail = appts.filter((a) => !Number.isNaN(a.bookedAt));
  const { result, suggestions } = runEngine({ now, settings: s, session, appointments: avail, history, slotMinutes: 10 });
  for (const sug of suggestions) {
    // a busy compounder confirms a no-show suggestion about 10 minutes after it first appears
    const a = sug.type === 'no_show' ? byId(sug.action.appointmentId!) : null;
    if (a && (now - a.bookedAt) / MIN > s.noShowMin + 10) a.status = 'no_show';
  }
  if (session.state === 'active' && !appts.some((a) => a.status === 'in_consultation') && result.line.length) {
    const next = byId(result.line[0]);
    next.status = 'in_consultation';
    next.consultStartedAt = now;
    next.calledAt = now;
  }
  // first estimate after check-in (what the patient was told on arrival)
  for (const id of result.line) {
    const e = result.estimates[id];
    if (firstEta[id] == null && e.expectedStartAt != null) {
      firstEta[id] = e.expectedStartAt;
      firstRange[id] = [e.lowAt!, e.highAt!];
    }
  }
}

console.log('\nDSS simulated day: Dr. Rahman, 6–9 PM, 10-min slots, starts 6:05, 10-min pause at 7:20\n');
console.log('Serial  Kind      Booked  Arrived  Est.start  Range         Actual  Error  Within range  Status');
const errors: number[] = [];
let inRange = 0;
for (const a of appts) {
  const actual = a.consultStartedAt ?? null;
  const est = firstEta[a.id] ?? null;
  const err = actual != null && est != null ? (actual - est) / MIN : null;
  const ok = actual != null && firstRange[a.id] ? actual >= firstRange[a.id][0] && actual <= firstRange[a.id][1] : null;
  if (err != null) errors.push(err);
  if (ok) inRange++;
  const kind = a.priorityLevel === 2 ? 'emergency' : a.visitSource === 'walk_in' ? 'walk-in' : 'booked';
  console.log(
    `${String(a.serialNo).padStart(6)}  ${kind.padEnd(9)} ${fmt(Number.isNaN(a.bookedAt) ? null : a.bookedAt).padEnd(7)} ${fmt(a.checkedInAt).padEnd(8)} ` +
    `${fmt(est).padEnd(10)} ${firstRange[a.id] ? `${fmt(firstRange[a.id][0])}-${fmt(firstRange[a.id][1])}` : '     -     '}   ` +
    `${fmt(actual).padEnd(7)} ${err == null ? '   - ' : `${err >= 0 ? '+' : ''}${err.toFixed(0)}`.padStart(5)}  ` +
    `${ok == null ? '-' : ok ? 'yes' : 'no'}`.padEnd(14) + `  ${a.status}`
  );
}
const mae = errors.reduce((x, y) => x + Math.abs(y), 0) / Math.max(1, errors.length);
console.log(`\nPatients seen: ${errors.length}. Average absolute estimate error: ${mae.toFixed(1)} min. ` +
  `Actual start inside the first range: ${inRange}/${errors.length}.`);
if (!Number.isFinite(mae) || mae > 15) {
  console.error('Estimate error too high (> 15 min): the engine regressed.');
  process.exit(1);
}
