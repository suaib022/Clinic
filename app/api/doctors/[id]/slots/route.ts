import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateSlots } from "@/lib/slots";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date'); // YYYY-MM-DD
  if (!dateStr) return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  
  const supabase = await createClient();
  const { slots, message } = await generateSlots(supabase, id, dateStr);
  
  return NextResponse.json({ slots, message });
}
