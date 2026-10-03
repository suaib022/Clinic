import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";

export async function POST(request: Request, { params }: { params: Promise<{ id: string, action: string }> }) {
  const { id, action } = await params;
  
  // Need to be authenticated (patient, doctor, compounder, admin depending on action)
  // The DB function enforces the specific RLS rules internally!
  // But we still call requireRole just to get the session and block unauthenticated.
  await requireRole(['admin', 'doctor', 'compounder', 'patient']);
  
  const supabase = await createClient();
  let rpcName = '';
  let args: any = { p_id: id };
  
  const body = await request.json().catch(() => ({}));

  switch (action) {
    case 'check-in':
      rpcName = 'check_in_appointment';
      break;
    case 'start':
      rpcName = 'start_consultation';
      break;
    case 'complete':
      rpcName = 'complete_consultation';
      break;
    case 'no-show':
      rpcName = 'mark_no_show';
      args.p_reason = body.reason || 'No show';
      break;
    case 'cancel':
      rpcName = 'cancel_appointment';
      args.p_reason = body.reason || 'Cancelled by user';
      break;
    case 'priority':
      rpcName = 'set_priority';
      args.p_reason = body.reason || 'Emergency';
      break;
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // We call the DB function as the logged-in user so RLS works!
  const { error } = await supabase.rpc(rpcName, args);
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
