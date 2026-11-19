import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/requireRole';

/** Lab staff land on the counter screen. */
export default async function LabDashboard() {
  await requireRole(['technician']);
  redirect('/lab/queue');
}
