import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/requireRole';

/**
 * Friendly shortcut route for /chamber -> redirects authenticated doctors,
 * compounders, or admins to the Chamber Desk.
 */
export default async function ChamberShortcutPage() {
    await requireRole(['doctor', 'admin', 'compounder']);
    redirect('/doctor/chamber');
}
