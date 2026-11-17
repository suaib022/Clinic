/** One simulated hospital day. Every time is a Dhaka wall-clock 'HH:MM'; every duration is minutes. */
export interface Scenario {
  day: { date: string };
  doctors: {
    id: string; sessionStart: string; sessionEnd: string; slotMin: number; bookedCount: number;
    startLateMeanMin: number; startLateSdMin: number; pause?: { at: string; min: number };
  }[];
  visits: { newMedianMin: number; followUpMedianMin: number; cv: number; followUpShare: number };
  patients: { latenessMeanMin: number; latenessSdMin: number; noShowP: number; walkInPerHour: number; emergencyShareOfWalkIns: number };
  lab: {
    orderP: number; testsPerOrder: [number, number]; nowP: number; outsidePerHour: number; open: string; close: string;
    lines: { id: string; name: string; typicalMin: number; cv: number; mustFirst: boolean; turnaroundMin: number; turnaroundCv: number; share: number }[];
  };
  returns: { sameDayWillingP: number; travelBufferMin: number };
  /**
   * Provenance for every parameter, keyed by its path (for example 'visits.newMedianMin').
   * Each value starts with [cited], [derived] or [assumption]; assumptions are covered by the sensitivity sweep.
   */
  sources: Record<string, string>;
}

const fail = (path: string, why: string): never => { throw new Error(`scenario.${path}: ${why}`); };
const obj = (v: unknown, path: string) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(path, 'must be an object'));
const arr = (v: unknown, path: string) => (Array.isArray(v) ? v : fail(path, 'must be an array'));
const num = (v: unknown, path: string, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : fail(path, `must be a number in [0, ${max}]`);
const prob = (v: unknown, path: string) => num(v, path, 1);
const str = (v: unknown, path: string) => (typeof v === 'string' && v.length > 0 ? v : fail(path, 'must be a non-empty string'));
const hhmm = (v: unknown, path: string) => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : fail(path, "must be 'HH:MM'"));
const bool = (v: unknown, path: string) => (typeof v === 'boolean' ? v : fail(path, 'must be true or false'));

/** Checks a parsed JSON scenario and returns it typed. Throws `scenario.<path>: <reason>`. */
export function parseScenario(json: unknown): Scenario {
  const r = obj(json, '(root)');
  const day = obj(r.day, 'day');
  const v = obj(r.visits, 'visits');
  const p = obj(r.patients, 'patients');
  const l = obj(r.lab, 'lab');
  const ret = obj(r.returns, 'returns');
  const tpo = arr(l.testsPerOrder, 'lab.testsPerOrder');
  const doctors = arr(r.doctors, 'doctors').map((d, i) => {
    const o = obj(d, `doctors[${i}]`);
    const pause = o.pause == null ? undefined : obj(o.pause, `doctors[${i}].pause`);
    return {
      id: str(o.id, `doctors[${i}].id`), sessionStart: hhmm(o.sessionStart, `doctors[${i}].sessionStart`),
      sessionEnd: hhmm(o.sessionEnd, `doctors[${i}].sessionEnd`), slotMin: num(o.slotMin, `doctors[${i}].slotMin`),
      bookedCount: num(o.bookedCount, `doctors[${i}].bookedCount`), startLateMeanMin: num(o.startLateMeanMin, `doctors[${i}].startLateMeanMin`),
      startLateSdMin: num(o.startLateSdMin, `doctors[${i}].startLateSdMin`),
      ...(pause ? { pause: { at: hhmm(pause.at, `doctors[${i}].pause.at`), min: num(pause.min, `doctors[${i}].pause.min`) } } : {}),
    };
  });
  if (doctors.length === 0) fail('doctors', 'needs at least one doctor');
  const lines = arr(l.lines, 'lab.lines').map((x, i) => {
    const o = obj(x, `lab.lines[${i}]`);
    return {
      id: str(o.id, `lab.lines[${i}].id`), name: str(o.name, `lab.lines[${i}].name`), typicalMin: num(o.typicalMin, `lab.lines[${i}].typicalMin`),
      cv: num(o.cv, `lab.lines[${i}].cv`), mustFirst: bool(o.mustFirst, `lab.lines[${i}].mustFirst`),
      turnaroundMin: num(o.turnaroundMin, `lab.lines[${i}].turnaroundMin`),
      turnaroundCv: num(o.turnaroundCv, `lab.lines[${i}].turnaroundCv`), share: num(o.share, `lab.lines[${i}].share`),
    };
  });
  const sources = obj(r.sources ?? {}, 'sources');
  return {
    day: { date: str(day.date, 'day.date') },
    doctors,
    visits: {
      newMedianMin: num(v.newMedianMin, 'visits.newMedianMin'), followUpMedianMin: num(v.followUpMedianMin, 'visits.followUpMedianMin'),
      cv: num(v.cv, 'visits.cv'), followUpShare: prob(v.followUpShare, 'visits.followUpShare'),
    },
    patients: {
      latenessMeanMin: typeof p.latenessMeanMin === 'number' ? p.latenessMeanMin : fail('patients.latenessMeanMin', 'must be a number'),
      latenessSdMin: num(p.latenessSdMin, 'patients.latenessSdMin'), noShowP: prob(p.noShowP, 'patients.noShowP'),
      walkInPerHour: num(p.walkInPerHour, 'patients.walkInPerHour'), emergencyShareOfWalkIns: prob(p.emergencyShareOfWalkIns, 'patients.emergencyShareOfWalkIns'),
    },
    lab: {
      orderP: prob(l.orderP, 'lab.orderP'),
      testsPerOrder: [num(tpo[0], 'lab.testsPerOrder[0]'), num(tpo[1], 'lab.testsPerOrder[1]')],
      nowP: prob(l.nowP, 'lab.nowP'), outsidePerHour: num(l.outsidePerHour, 'lab.outsidePerHour'),
      open: hhmm(l.open, 'lab.open'), close: hhmm(l.close, 'lab.close'), lines,
    },
    returns: { sameDayWillingP: prob(ret.sameDayWillingP, 'returns.sameDayWillingP'), travelBufferMin: num(ret.travelBufferMin, 'returns.travelBufferMin') },
    sources: Object.fromEntries(Object.entries(sources).map(([k, x]) => [k, String(x)])),
  };
}
