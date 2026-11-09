import DashboardSidebar from '@/components/DashboardSidebar';
import AutoRefresh from '@/components/queue/AutoRefresh';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { todayDhaka } from '@/lib/format';
import { getQueueSnapshot } from '@/lib/queue/server';
import { SESSION_TEXT, SESSION_CLASS, fmtTime } from '@/lib/queue/display';

export const metadata = { title: 'Live Clinic Board' };

/** DSS-92: read-only board of every doctor with a queue today (session, now serving, delay, waiting). */
export default async function QueueBoardPage() {
  await requireRole(['admin']);
  const supabase = await createClient();
  const today = todayDhaka();
  const [{ data: appts }, { data: sessions }] = await Promise.all([
    supabase.from('appointments').select('doctor_id').eq('appointment_date', today).not('status', 'in', '(hold,cancelled)'),
    supabase.from('doctor_sessions').select('doctor_id').eq('session_date', today),
  ]);
  const ids = [...new Set([...(appts ?? []), ...(sessions ?? [])].map((r) => r.doctor_id as string))];
  const boards = (await Promise.all(ids.map((id) => getQueueSnapshot(supabase, id).catch(() => null))))
    .filter((b): b is NonNullable<typeof b> => !!b)
    .sort((a, b) => b.result.summary.delayMin - a.result.summary.delayMin);
  return (
    <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
      <AutoRefresh seconds={30} />
      <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
        <DashboardSidebar role="admin" />
        <div className="flex-grow-1 p-3 p-md-5" style={{ minWidth: 0 }}>
          <div className="container-fluid" style={{ maxWidth: 1200 }}>
            <h2 className="mb-4 pb-3" style={{ color: '#0D7D72', borderBottom: '3px solid #0D7D72' }}><i className="bi bi-broadcast me-2" aria-hidden="true"></i>Live Clinic Board · {today}</h2>
            <div className="table-responsive card border-0 shadow-sm">
              <table className="table align-middle mb-0">
                <thead><tr><th>Doctor</th><th>Session</th><th>Now serving</th><th className="text-end">Delay</th><th className="text-end">Waiting</th><th className="text-end">Not arrived</th><th className="text-end">Seen</th><th className="text-end">No-shows</th></tr></thead>
                <tbody>
                  {boards.length === 0 && <tr><td colSpan={8} className="text-center text-muted py-4">No doctor has a queue today.</td></tr>}
                  {boards.map((b) => (
                    <tr key={b.doctor.id}>
                      <td className="fw-semibold">{b.doctor.name}<div className="small text-muted">{b.doctor.speciality}</div></td>
                      <td><span className={`badge ${SESSION_CLASS[b.session.state]}`}>{SESSION_TEXT[b.session.state]}</span>
                        {b.session.startedAt && <div className="small text-muted">since {fmtTime(b.session.startedAt)}</div>}</td>
                      <td>{b.result.nowServing ? `#${b.result.nowServing.serialNo}` : '—'}</td>
                      <td className={`text-end ${b.result.summary.delayMin >= b.settings.doctorLateAlertMin ? 'text-danger fw-bold' : ''}`}>{b.result.summary.delayMin} min</td>
                      <td className="text-end">{b.result.summary.waiting}</td>
                      <td className="text-end">{b.result.summary.notArrived}</td>
                      <td className="text-end">{b.result.summary.seen}</td>
                      <td className="text-end">{b.result.summary.noShows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small text-muted mt-2">Refreshes every 30 seconds.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
