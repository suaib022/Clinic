'use client';
import { useState, useTransition } from 'react';
import { updateDssSettings } from '@/lib/queue/adminActions';
import type { SettingsValues } from '@/lib/queue/settingsSchema';

const FIELDS: Array<[Num, string, string]> = [
  ['on_time_band_min', 'On-time band (min)', 'Up to this many minutes early or late still counts as "On time".'],
  ['late_band_min', 'Late band (min)', 'More than this many minutes late counts as "Delayed".'],
  ['grace_min', 'Grace (min)', 'Minutes after the slot before a patient counts as late to arrive.'],
  ['no_show_min', 'No-show after (min)', 'Minutes after the slot before a no-show is suggested.'],
  ['doctor_late_alert_min', 'Doctor late alert (min)', 'Suggest telling patients when the doctor is this far behind.'],
  ['near_turn_count', 'Near-turn count', 'Tell the patient when this many people are ahead.'],
  ['undo_window_sec', 'Undo window (sec)', 'How long a tap can be undone.'],
  ['min_duration_samples', 'Min. history samples', 'Past visits needed before the doctor’s own history is trusted.'],
  ['default_slot_min', 'Default slot (min)', 'Used only if a doctor’s schedule has no slot length.'],
  ['duration_clamp_min', 'Shortest visit estimate (min)', 'A visit estimate is never below this.'],
  ['duration_clamp_max', 'Longest visit estimate (min)', 'A visit estimate is never above this.'],
];

type Num = Exclude<{ [K in keyof SettingsValues]: SettingsValues[K] extends number ? K : never }[keyof SettingsValues], never>;
const ENGINE_FIELDS: Array<[Num, string, string, number]> = [
  ['history_window', 'Visit history used (visits)', 'How many recent visits feed the visit-length estimate (DSS rule: 30).', 1],
  ['report_review_min', 'Report review visit (min)', 'Minutes assumed for a short visit to show a lab report.', 1],
  ['show_p', 'Show-up rate', 'Chance a booked patient who has not arrived still comes (1 minus the no-show rate).', 0.01],
  ['walk_in_per_hour', 'Walk-ins per hour', 'Expected walk-ins for this clinic; counted ahead of later patients.', 0.5],
  ['lateness_mean_min', 'Arrival vs slot, mean (min)', 'Negative = patients arrive early on average.', 1],
  ['lateness_sd_min', 'Arrival vs slot, spread (min)', 'Standard deviation of arrival time around the slot.', 1],
  ['range_coverage', 'Range coverage', 'Share of patients whose real start should fall inside the shown range (0.5 to 0.99).', 0.01],
];

export default function SettingsForm({ initial }: { initial: SettingsValues }) {
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="card border-0 shadow-sm rounded-3" onSubmit={(e) => {
      e.preventDefault();
      start(async () => { const r = await updateDssSettings(v); setMsg({ ok: r.ok, text: r.message }); });
    }}>
      <div className="card-body row g-3">
        <div className="col-12">
          <label className="form-label fw-semibold" htmlFor="engine_mode">Wait-time engine</label>
          <select id="engine_mode" className="form-select" value={v.engine_mode}
            onChange={(e) => setV({ ...v, engine_mode: e.target.value as SettingsValues['engine_mode'] })} aria-describedby="engine_mode-help">
            <option value="dss">DSS rules (default)</option>
            <option value="full">Full engine (expected arrivals, calibrated range)</option>
          </select>
          <div id="engine_mode-help" className="form-text">
            Switches the doctor queue and patient estimates. The full-engine settings below apply only in Full mode; lab lines are not affected.
          </div>
        </div>
        {FIELDS.map(([k, label, help]) => (
          <div key={k} className="col-12 col-md-6">
            <label className="form-label fw-semibold" htmlFor={k}>{label}</label>
            <input id={k} type="number" className="form-control" value={v[k]} required
              onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} aria-describedby={`${k}-help`} />
            <div id={`${k}-help`} className="form-text">{help}</div>
          </div>
        ))}
        <div className="col-12"><hr className="my-1" /><h6 className="mb-0">Full engine settings</h6></div>
        <div className="col-12 col-md-6">
          <label className="form-label fw-semibold" htmlFor="sum_with">Add up visits using</label>
          <select id="sum_with" className="form-select" value={v.sum_with} disabled={v.engine_mode !== 'full'}
            onChange={(e) => setV({ ...v, sum_with: e.target.value as SettingsValues['sum_with'] })}>
            <option value="median">Median visit length</option><option value="mean">Mean visit length</option>
          </select>
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label fw-semibold" htmlFor="range_method">Range shown to patients</label>
          <select id="range_method" className="form-select" value={v.range_method} disabled={v.engine_mode !== 'full'}
            onChange={(e) => setV({ ...v, range_method: e.target.value as SettingsValues['range_method'] })}>
            <option value="quartile_sum">Quartile sum (DSS rule)</option><option value="normal_sum">Calibrated (normal sum)</option>
          </select>
        </div>
        <div className="col-12">
          <div className="form-check">
            <input id="expect_arrivals" type="checkbox" className="form-check-input" checked={v.expect_arrivals} disabled={v.engine_mode !== 'full'}
              onChange={(e) => setV({ ...v, expect_arrivals: e.target.checked })} />
            <label className="form-check-label" htmlFor="expect_arrivals">Count booked patients and walk-ins who have not arrived yet</label>
          </div>
        </div>
        {ENGINE_FIELDS.map(([k, label, help, step]) => (
          <div key={k} className="col-12 col-md-6">
            <label className="form-label fw-semibold" htmlFor={k}>{label}</label>
            <input id={k} type="number" step={step} className="form-control" value={v[k]} required disabled={v.engine_mode !== 'full'}
              onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} aria-describedby={`${k}-help`} />
            <div id={`${k}-help`} className="form-text">{help}</div>
          </div>
        ))}
      </div>
      <div className="card-footer bg-white d-flex align-items-center gap-3">
        <button type="submit" className="btn" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</button>
        {msg && <span role="status" className={msg.ok ? 'text-success' : 'text-danger'}>{msg.text}</span>}
      </div>
    </form>
  );
}
