import os

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content.strip() + '\n')

# 1. API: GET /api/specialities
write_file('app/api/specialities/route.ts', '''
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase.from('specialities').select('id, name').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
''')

# 2. API: GET /api/doctors
write_file('app/api/doctors/route.ts', '''
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const speciality_id = searchParams.get('speciality_id');
  const supabase = createClient();
  
  let query = supabase.from('users').select('id, full_name, avatar_url').eq('role', 'doctor');
  
  if (speciality_id) {
    // Need to join via doctor_specialities
    const { data, error } = await supabase
      .from('doctor_specialities')
      .select('users!inner(id, full_name, avatar_url)')
      .eq('speciality_id', speciality_id);
      
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const doctors = data.map(d => d.users);
    return NextResponse.json(doctors);
  } else {
    const { data, error } = await query.order('full_name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
}
''')

# 3. API: GET /api/doctors/[id]
write_file('app/api/doctors/[id]/route.ts', '''
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  
  // Get doctor info
  const { data: doc, error: docError } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')
    .eq('id', params.id)
    .single();
    
  if (docError) return NextResponse.json({ error: docError.message }, { status: 404 });
  
  // Get specialities
  const { data: specs } = await supabase
    .from('doctor_specialities')
    .select('specialities(name)')
    .eq('doctor_id', params.id);
  const specialityNames = specs?.map(s => (s.specialities as any).name).join(', ') || '';
  
  // Get schedules
  const { data: schedules } = await supabase
    .from('doctor_schedules')
    .select('*')
    .eq('doctor_id', params.id)
    .eq('is_active', true)
    .order('day_of_week');
    
  return NextResponse.json({
    ...doc,
    speciality: specialityNames,
    schedules: schedules || [],
    consultation_fee: 1200 // Mocking fee for now as requested
  });
}
''')

# 4. API: GET /api/doctors/[id]/slots
write_file('app/api/doctors/[id]/slots/route.ts', '''
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { parse, addMinutes, format, isBefore, isEqual, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz'; // Need date-fns-tz for tz support

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date'); // YYYY-MM-DD
  if (!dateStr) return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  
  const supabase = createClient();
  
  // What day of week is it? (0=Sun, 6=Sat)
  const targetDate = new Date(dateStr);
  const dayOfWeek = targetDate.getDay();
  
  // 1. Get doctor's schedule for this day
  const { data: schedule } = await supabase
    .from('doctor_schedules')
    .select('*')
    .eq('doctor_id', params.id)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .single();
    
  if (!schedule) {
    return NextResponse.json({ slots: [], message: 'Doctor not available on this day.' });
  }
  
  // 2. Check full day leave
  const { data: leaves } = await supabase
    .from('doctor_leave_requests')
    .select('*')
    .eq('doctor_id', params.id)
    .eq('status', 'approved')
    .lte('start_date', dateStr)
    .gte('end_date', dateStr);
    
  if (leaves && leaves.some(l => l.type === 'full_day')) {
    return NextResponse.json({ slots: [], message: 'Doctor is on leave.' });
  }
  
  // 3. Get breaks
  const { data: breaks } = await supabase
    .from('doctor_schedule_breaks')
    .select('*')
    .eq('doctor_id', params.id)
    .eq('day_of_week', dayOfWeek);
    
  // 4. Get existing bookings
  const { data: bookings } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('doctor_id', params.id)
    .eq('appointment_date', dateStr)
    .not('status', 'eq', 'cancelled');
    
  // Generate 10 minute slots
  const slots = [];
  const baseDateStr = dateStr + 'T';
  let currentSlot = parse(schedule.start_time, 'HH:mm:ss', targetDate);
  const endTime = parse(schedule.end_time, 'HH:mm:ss', targetDate);
  const slotDuration = schedule.slot_duration_minutes || 10;
  
  // Get current time in Dhaka
  const nowInDhaka = toZonedTime(new Date(), 'Asia/Dhaka');
  
  while (isBefore(currentSlot, endTime)) {
    const slotEnd = addMinutes(currentSlot, slotDuration);
    if (isBefore(endTime, slotEnd)) break; // Don't overshoot
    
    const slotStartStr = format(currentSlot, 'HH:mm:ss');
    const slotEndStr = format(slotEnd, 'HH:mm:ss');
    const slotDisplay = format(currentSlot, 'HH:mm');
    
    // Skip if in the past (only if today)
    // We compare strings 'YYYY-MM-DD HH:mm:ss'
    const currentSlotZoned = toZonedTime(currentSlot, 'Asia/Dhaka');
    if (dateStr === format(nowInDhaka, 'yyyy-MM-dd')) {
        if (isBefore(currentSlotZoned, nowInDhaka)) {
             currentSlot = slotEnd;
             continue;
        }
    }

    // Check if slot falls in a break
    let inBreak = false;
    for (const b of (breaks || [])) {
        if (slotStartStr >= b.start_time && slotStartStr < b.end_time) {
            inBreak = true;
            break;
        }
    }
    
    // Check if slot is booked
    let isBooked = false;
    for (const b of (bookings || [])) {
        if (slotStartStr === b.start_time) {
            isBooked = true;
            break;
        }
    }
    
    // Check partial leave (if any)
    let inLeave = false;
    for (const l of (leaves || [])) {
        if (l.type === 'partial_day' && l.start_time && l.end_time) {
            if (slotStartStr >= l.start_time && slotStartStr < l.end_time) {
                inLeave = true;
                break;
            }
        }
    }
    
    slots.push({
        time: slotDisplay,
        start_time: slotStartStr,
        available: !inBreak && !isBooked && !inLeave
    });
    
    currentSlot = slotEnd;
  }
  
  return NextResponse.json({ slots, message: 'Success' });
}
''')

# 5. API: POST /api/appointments
write_file('app/api/appointments/route.ts', '''
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { addMinutes, parse, format } from "date-fns";

export async function POST(request: Request) {
  const supabase = createClient();
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
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
      patient_id: session.user.id,
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
''')

print("APIs generated successfully.")
