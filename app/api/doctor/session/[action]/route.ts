import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  await requireRole(['admin', 'doctor']);
  
  const supabase = await createClient();
  const body = await request.json().catch(() => ({}));
  let rpcName = '';
  let args: any = { p_doctor_id: body.doctor_id };

  switch (action) {
    case 'start':
      rpcName = 'start_doctor_session';
      break;
    case 'pause':
      rpcName = 'pause_doctor_session';
      args.p_reason = body.reason || 'Paused by user';
      break;
    case 'resume':
      rpcName = 'resume_doctor_session';
      break;
    case 'end':
      rpcName = 'end_doctor_session';
      break;
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const { error } = await supabase.rpc(rpcName, args);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
