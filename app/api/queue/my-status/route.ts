import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { getApiUser, getMyStatus } from '@/lib/queue/server';
import { allow } from '@/lib/queue/rateLimit';
import { json, errorResponse } from '../_http';

const Query = z.object({ appointmentId: z.string().uuid() });

/** DSS-42: a patient's own live queue status (self or family member on the same account). Nothing about other patients. */
export async function GET(req: NextRequest) {
  const u = await getApiUser();
  if (!u) return json({ error: 'Login required' }, 401);
  if (u.role !== 'patient') return json({ error: 'Only for patients' }, 403);
  const q = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return json({ error: 'Invalid appointmentId' }, 400);
  if (!allow(`my-status:${u.userId}`, 60)) return json({ error: 'Too many requests. Please slow down.' }, 429);
  try {
    return json(await getMyStatus(u.supabase, u.userId, q.data.appointmentId));
  } catch (e) {
    return errorResponse(e);
  }
}
