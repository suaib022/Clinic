import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { todayDhaka } from '@/lib/format';
import { z } from 'zod';

export const metadata = { title: 'Queue Reports' };

const Q = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  doctor: z.string().uuid().optional().or(z.literal('')),
  speciality: z.string().max(80).optional(),
});
interface Row {
  doctor_id: string; doctor_name: string; speciality: string | null; booked: number; seen: number; no_shows: number; walk_ins: number;
  no_show_rate: number | null; walk_in_share: number | null; avg_visit_new: number | null; avg_visit_follow_up: number | null;
  avg_start_delay: number | null; estimate_mae: number | null; estimate_samples: number; busiest_hour: number | null;
}
const v = (x: number | null, unit = '') => (x == null ? '—' : `${x}${unit}`);
const hour = (h: number | null) => (h == null ? '—' : `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`);

/** DSS-93: visit length (new / follow-up), start delay, no-show rate, walk-in share, first-estimate accuracy, busiest waiting hour. */
export default async function QueueReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole(['admin']);
  const supabase = await createClient();
  const q = Q.safeParse(await searchParams);
  const today = todayDhaka();
  const to = (q.success && q.data.to) || today;
  const from = (q.success && q.data.from) || new Date(Date.parse(to) - 29 * 86400_000).toISOString().slice(0, 10);
  const doctor = (q.success && q.data.doctor) || null;
  const speciality = (q.success && q.data.speciality) || null;
  const [{ data, error }, { data: doctors }, { data: specs }] = await Promise.all([
    supabase.rpc('dss_report', { p_from: from, p_to: to, p_doctor: doctor, p_speciality: speciality }),
    supabase.from('users').select('id, full_name').eq('role', 'doctor').order('full_name'),
    supabase.from('specialities').select('name').order('name'),
  ]);
  const rows = (data ?? []) as Row[];
  return (
    <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
      <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
        <DashboardSidebar role="admin" />
        <div className="flex-grow-1 p-3 p-md-5" style={{ minWidth: 0 }}>
          <div className="container-fluid" style={{ maxWidth: 1300 }}>
            <h2 className="mb-4 pb-3" style={{ color: '#0D7D72', borderBottom: '3px solid #0D7D72' }}><i className="bi bi-graph-up me-2" aria-hidden="true"></i>Queue Reports</h2>
            <form className="row g-2 align-items-end mb-4" method="get">
              <div className="col-6 col-md-2"><label className="form-label small" htmlFor="from">From</label><input id="from" name="from" type="date" className="form-control" defaultValue={from} /></div>
              <div className="col-6 col-md-2"><label className="form-label small" htmlFor="to">To</label><input id="to" name="to" type="date" className="form-control" defaultValue={to} /></div>
              <div className="col-12 col-md-3"><label className="form-label small" htmlFor="doctor">Doctor</label>
                <select id="doctor" name="doctor" className="form-select" defaultValue={doctor ?? ''}><option value="">All doctors</option>{(doctors ?? []).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select></div>
              <div className="col-12 col-md-3"><label className="form-label small" htmlFor="speciality">Department</label>
                <select id="speciality" name="speciality" className="form-select" defaultValue={speciality ?? ''}><option value="">All departments</option>{(specs ?? []).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}</select></div>
              <div className="col-12 col-md-2"><button type="submit" className="btn w-100">Show</button></div>
            </form>
            {error && <div className="alert alert-danger">Could not load the report.</div>}
            <div className="table-responsive card border-0 shadow-sm">
              <table className="table table-sm align-middle mb-0 small">
                <thead><tr>
                  <th>Doctor</th><th className="text-end">Booked</th><th className="text-end">Seen</th><th className="text-end">No-show %</th><th className="text-end">Walk-in %</th>
                  <th className="text-end">Avg visit new</th><th className="text-end">Avg visit follow-up</th><th className="text-end">Avg start delay</th>
                  <th className="text-end">First-estimate error</th><th className="text-end">Busiest wait hour</th>
                </tr></thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={10} className="text-center text-muted py-4">No visits in this range.</td></tr>}
                  {rows.map((r) => (
                    <tr key={r.doctor_id}>
                      <td className="fw-semibold">{r.doctor_name}<div className="text-muted">{r.speciality}</div></td>
                      <td className="text-end">{r.booked}</td><td className="text-end">{r.seen}</td>
                      <td className="text-end">{v(r.no_show_rate, '%')}</td><td className="text-end">{v(r.walk_in_share, '%')}</td>
                      <td className="text-end">{v(r.avg_visit_new, ' min')}</td><td className="text-end">{v(r.avg_visit_follow_up, ' min')}</td>
                      <td className="text-end">{v(r.avg_start_delay, ' min')}</td>
                      <td className="text-end">{r.estimate_samples ? `${v(r.estimate_mae, ' min')} (${r.estimate_samples})` : '—'}</td>
                      <td className="text-end">{hour(r.busiest_hour)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small text-muted mt-2">{from} to {to}. Estimate error = first estimate after check-in vs. the real start (average, minutes).</p>
          </div>
        </div>
      </div>
    </main>
  );
}
