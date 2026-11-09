import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { calculateQueueEstimate } from '@/lib/queue/decisionSupport';
import { getApiUser } from '@/lib/queue/server';
import { allow } from '@/lib/queue/rateLimit';
import { todayDhaka } from '@/lib/format';
import { json } from '../_http';

/**
 * @deprecated Legacy estimate endpoint. Was public and read everything with the service role (DSS-43).
 * Now: login required; patients may ask only about their own appointments (by id); staff may also look up
 * by UHID or serial, but only for doctors they are assigned to. New screens use /api/queue/snapshot and
 * /api/queue/my-status instead.
 */
const Input = z.object({
  appointmentId: z.string().uuid().optional(),
  uhid: z.string().trim().min(1).max(40).optional(),
  doctorId: z.string().uuid().optional(),
  serialNo: z.coerce.number().int().min(1).max(9999).optional(),
});

async function handle(raw: Record<string, unknown>) {
  const u = await getApiUser();
  if (!u) return json({ success: false, error: 'Login required' }, 401);
  if (!allow(`estimate:${u.userId}`, 30)) return json({ success: false, error: 'Too many requests' }, 429);
  const p = Input.safeParse(raw);
  if (!p.success) return json({ success: false, error: 'Invalid input' }, 400);
  const { appointmentId, uhid, doctorId, serialNo } = p.data;

  let targetId = appointmentId ?? null;
  if (!targetId) {
    // Lookups by UHID/serial are a front-desk feature: staff only, assigned doctors only.
    if (u.role === 'patient' || !doctorId || (!uhid && !serialNo)) {
      return json({ success: false, error: 'Provide appointment_id' }, 400);
    }
    let q = u.supabase.from('appointments').select('id, patient:patients!inner(uhid)')
      .eq('doctor_id', doctorId).eq('appointment_date', todayDhaka()).neq('status', 'cancelled');
    if (uhid) q = q.eq('patient.uhid', uhid);
    if (serialNo) q = q.eq('serial_no', serialNo);
    const { data } = await q.limit(1);
    targetId = data?.[0]?.id ?? null;
  }
  if (!targetId) return json({ success: false, error: 'No matching appointment today' }, 404);

  // Authorise against the appointment's owner / doctor before the service-role read inside the wrapper.
  const { data: appt } = await u.supabase
    .from('appointments').select('doctor_id, patient:patients!inner(auth_user_id)').eq('id', targetId).maybeSingle();
  const ownerId = (appt?.patient as unknown as { auth_user_id: string } | null)?.auth_user_id;
  let allowed = false;
  if (appt && u.role === 'patient') allowed = ownerId === u.userId;
  if (appt && u.role !== 'patient') {
    const { data: can } = await u.supabase.rpc('dss_can_manage', { p_doctor: appt.doctor_id });
    allowed = can === true;
  }
  if (!allowed) return json({ success: false, error: 'Appointment not found' }, 404);

  try {
    return json(await calculateQueueEstimate(targetId));
  } catch {
    return json({ success: false, error: 'Queue estimate unavailable' }, 500);
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return handle({
    appointmentId: sp.get('appointment_id') ?? undefined,
    uhid: sp.get('uhid') ?? undefined,
    doctorId: sp.get('doctor_id') ?? undefined,
    serialNo: sp.get('serial_no') ?? undefined,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return handle({ appointmentId: body.appointmentId, uhid: body.uhid, doctorId: body.doctorId, serialNo: body.serialNo });
}
