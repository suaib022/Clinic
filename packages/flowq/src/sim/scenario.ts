import { DEFAULT_SETTINGS, type DssSettings } from '../engine/types';

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
   * What chamber staff do (all follow the app's rules). awayWhenCalledP: the called patient is not there, so staff skip them;
   * they come back after Lognormal(awayMedianMin, awayCv) with comesBackP and rejoin. skipLateP: a booked patient not here
   * at slot + grace is skipped; on arrival they check in and rejoin. priorityP: staff mark a patient priority at check-in.
   * undoCallP: staff call the wrong patient and undo it.
   */
  staff: { awayWhenCalledP: number; awayMedianMin: number; awayCv: number; comesBackP: number; skipLateP: number; priorityP: number; undoCallP: number };
  /** Engine settings to use in this experiment (unset keys keep the defaults; lab lines default to historyWindow 200, sumWith 'mean'). */
  engine: { doctor: Partial<DssSettings>; lab: Partial<DssSettings> };
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
  const st = obj(r.staff, 'staff');
  const sources = obj(r.sources ?? {}, 'sources');
  const eng = obj(r.engine ?? {}, 'engine');
  const engineSide = (v: unknown, path: string): Partial<DssSettings> => {
    const o = obj(v ?? {}, path);
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) {
      const def = (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[k];
      if (def === undefined) fail(`${path}.${k}`, 'is not an engine setting');
      if (k === 'latenessMeanMin') out[k] = typeof x === 'number' && Number.isFinite(x) ? x : fail(`${path}.${k}`, 'must be a number');
      else if (typeof def === 'number') out[k] = num(x, `${path}.${k}`);
      else if (typeof def === 'boolean') out[k] = bool(x, `${path}.${k}`);
      else if (k === 'sumWith') out[k] = x === 'mean' || x === 'median' ? x : fail(`${path}.${k}`, "must be 'median' or 'mean'");
      else if (k === 'rangeMethod') out[k] = x === 'quartile_sum' || x === 'normal_sum' ? x : fail(`${path}.${k}`, "must be 'quartile_sum' or 'normal_sum'");
      else out[k] = str(x, `${path}.${k}`);
    }
    return out as Partial<DssSettings>;
  };
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
    staff: {
      awayWhenCalledP: prob(st.awayWhenCalledP, 'staff.awayWhenCalledP'), awayMedianMin: num(st.awayMedianMin, 'staff.awayMedianMin'),
      awayCv: num(st.awayCv, 'staff.awayCv'), comesBackP: prob(st.comesBackP, 'staff.comesBackP'), skipLateP: prob(st.skipLateP, 'staff.skipLateP'),
      priorityP: prob(st.priorityP, 'staff.priorityP'), undoCallP: prob(st.undoCallP, 'staff.undoCallP'),
    },
    engine: { doctor: engineSide(eng.doctor, 'engine.doctor'), lab: engineSide(eng.lab, 'engine.lab') },
    sources: Object.fromEntries(Object.entries(sources).map(([k, x]) => [k, String(x)])),
  };
}
