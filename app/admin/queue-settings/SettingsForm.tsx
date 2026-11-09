'use client';
import { useState, useTransition } from 'react';
import { updateDssSettings, type SettingsValues } from '@/lib/queue/adminActions';

const FIELDS: Array<[keyof SettingsValues, string, string]> = [
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
        {FIELDS.map(([k, label, help]) => (
          <div key={k} className="col-12 col-md-6">
            <label className="form-label fw-semibold" htmlFor={k}>{label}</label>
            <input id={k} type="number" className="form-control" value={v[k]} required
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
