import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { addMinutes, parse, format } from "date-fns";

export async function POST(request: Request) {
  const supabase = await createClient();
  
  const { data: { session } } = await supabase.auth.getSession();
  
  const body = await request.json();
  const { doctor_id, appointment_date, start_time } = body;
  
  if (!doctor_id || !appointment_date || !start_time) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  
  // Calculate end_time (assume 10 mins for now, in a real app query doctor_schedules)
  const startTimeParsed = parse(start_time, 'HH:mm:ss', new Date());
  const endTimeParsed = addMinutes(startTimeParsed, 10);
  const end_time = format(endTimeParsed, 'HH:mm:ss');
  
  // Insert with unique constraint handling
  const { data, error } = await supabase.from('appointments').insert({
      patient_id: session?.user?.id || null,
      doctor_id,
      appointment_date,
      start_time,
      end_time,
      status: 'scheduled'
  }).select().single();
  
  if (error) {
      if (error.code === '23505') { // Unique constraint violation
          return NextResponse.json({ error: 'Slot just taken, pick another' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ success: true, appointment: data });
}
