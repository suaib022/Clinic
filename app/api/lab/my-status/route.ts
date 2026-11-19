import { NextResponse } from 'next/server';
import { getApiUser } from '@/lib/queue/server';
import { allow } from '@/lib/queue/rateLimit';
import { getMyLab } from '@/lib/lab/myLab';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

/** A patient's own lab places and reports today (self or family members on the same account). Nothing about other patients. */
export async function GET() {
  const u = await getApiUser();
  if (!u) return NextResponse.json({ error: 'Login required' }, { status: 401, headers: NO_STORE });
  if (u.role !== 'patient') return NextResponse.json({ error: 'Only for patients' }, { status: 403, headers: NO_STORE });
  if (!allow(`lab-my-status:${u.userId}`, 60)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429, headers: NO_STORE });
  try {
    return NextResponse.json(await getMyLab(u.supabase, u.userId), { headers: NO_STORE });
  } catch (e) {
    console.error('[lab my-status]', e);
    return NextResponse.json({ error: 'Lab data is unavailable right now.' }, { status: 500, headers: NO_STORE });
  }
}
