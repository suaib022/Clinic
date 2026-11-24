// Flow Lab, live tab: run the same queue snapshot through the DSS rules and through the full flowq engine and put the
// numbers side by side. Pure (no Supabase / Next), unit-tested.
import { runEngine, type DssSettings, type PatientEstimate, type Stage } from '@/lib/queue/engine';
import { settingsFromRow, toEngineInput, type RawSnapshot } from '@/lib/queue/snapshotInput';

/**
 * Full-engine settings used for the comparison: the configuration of the flowq evaluation on the HospitalOPD-calibrated
 * scenario (mean sums, expected arrivals, show-up rate 0.77, 2 walk-ins/hour, patients arrive 10 +- 10 min early,
 * calibrated range with nominal coverage 0.85, 60 visits of history). These are study values, not this clinic's.
 */
export const FULL_PRESET_ROW = {
  engine_mode: 'full', history_window: 60, sum_with: 'mean', expect_arrivals: true, show_p: 0.77, walk_in_per_hour: 2,
  lateness_mean_min: -10, lateness_sd_min: 10, range_method: 'normal_sum', range_coverage: 0.85,
} as const;

export interface ModeEstimate {
  expectedStartAt: number | null;
  lowAt: number | null;
  highAt: number | null;
  waitMinLow: number | null;
  waitMinHigh: number | null;
  confidence: PatientEstimate['confidence'];
}
export interface CompareRow {
  appointmentId: string;
  serialNo: number;
  patientName: string | null;
  stage: Stage;
  bookedAt: number;
  patientsAhead: number | null;
  dss: ModeEstimate;
  full: ModeEstimate;
  /** full minus DSS expected start, minutes (null if either is missing). */
  shiftMin: number | null;
}
export interface Comparison {
  now: number;
  /** Mode the live screens use right now (the admin switch). */
  liveMode: 'dss' | 'full';
  dssSettings: DssSettings;
  fullSettings: DssSettings;
  rows: CompareRow[];
  /** Mean width of the shown range, minutes (patients with a range in both modes). */
  meanRangeMin: { dss: number | null; full: number | null };
}

const pick = (e: PatientEstimate | undefined): ModeEstimate => ({
  expectedStartAt: e?.expectedStartAt ?? null, lowAt: e?.lowAt ?? null, highAt: e?.highAt ?? null,
  waitMinLow: e?.waitMinLow ?? null, waitMinHigh: e?.waitMinHigh ?? null, confidence: e?.confidence ?? null,
});
const ACTIVE: Stage[] = ['in_room', 'waiting', 'not_arrived', 'skipped'];

export function compareModes(raw: RawSnapshot, now = Date.parse(raw.server_now)): Comparison {
  const input = toEngineInput(raw, now);
  const base = raw.settings ?? {};
  const dssSettings = settingsFromRow({ ...base, engine_mode: 'dss' });
  const fullSettings = settingsFromRow({ ...base, ...FULL_PRESET_ROW });
  const dss = runEngine({ ...input, settings: dssSettings }).result;
  const full = runEngine({ ...input, settings: fullSettings }).result;
  const byId = new Map(input.appointments.map((a) => [a.id, a]));
  const rows: CompareRow[] = Object.values(full.estimates)
    .filter((e) => ACTIVE.includes(e.stage))
    .map((e) => {
      const a = byId.get(e.appointmentId);
      const d = pick(dss.estimates[e.appointmentId]);
      const f = pick(e);
      return {
        appointmentId: e.appointmentId, serialNo: e.serialNo, patientName: a?.patientName ?? null, stage: e.stage,
        bookedAt: a?.bookedAt ?? 0, patientsAhead: e.patientsAhead, dss: d, full: f,
        shiftMin: d.expectedStartAt != null && f.expectedStartAt != null ? Math.round((f.expectedStartAt - d.expectedStartAt) / 60000) : null,
      };
    })
    .sort((a, b) => a.serialNo - b.serialNo);
  const width = (pickMode: 'dss' | 'full') => {
    const w = rows.filter((r) => r.dss.lowAt != null && r.dss.highAt != null && r.full.lowAt != null && r.full.highAt != null)
      .map((r) => (r[pickMode].highAt! - r[pickMode].lowAt!) / 60000);
    return w.length ? Math.round((w.reduce((x, y) => x + y, 0) / w.length) * 10) / 10 : null;
  };
  return {
    now, liveMode: base.engine_mode === 'full' ? 'full' : 'dss', dssSettings, fullSettings, rows,
    meanRangeMin: { dss: width('dss'), full: width('full') },
  };
}
