import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { parse, addMinutes, format, isBefore, isEqual, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz'; // Need date-fns-tz for tz support

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date'); // YYYY-MM-DD
  if (!dateStr) return NextResponse.json({ error: 'Date is required' }, { status: 400 });
  
  const supabase = await createClient();
  
  // What day of week is it? (0=Sun, 6=Sat)
  const targetDate = new Date(dateStr);
  const dayOfWeek = targetDate.getDay();
  
  // 1. Get doctor's schedule for this day
  const { data: schedule } = await supabase
    .from('doctor_schedules')
    .select('*')
    .eq('doctor_id', id)
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
    .eq('doctor_id', id)
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
    .eq('doctor_id', id)
    .eq('day_of_week', dayOfWeek);
    
  // 4. Get existing bookings
  const { data: bookings } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('doctor_id', id)
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
    const slotDisplay = format(currentSlot, 'h:mm a');
    
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
