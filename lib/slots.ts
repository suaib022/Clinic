
import { parse, addMinutes, format, isBefore } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export type Slot = {
  time: string;
  start_time: string;
  available: boolean;
  serial_no: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateSlots(supabase: any, doctorId: string, dateStr: string): Promise<{ slots: Slot[], message: string, slotDuration: number }> {
  const targetDate = new Date(dateStr);
  const dayOfWeek = targetDate.getDay();
  
  // 1. Get schedule
  const { data: schedule } = await supabase
    .from('doctor_schedules')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .single();
    
  if (!schedule) {
    return { slots: [], message: 'Doctor not available on this day.', slotDuration: 10 };
  }
  
  // 2. Full day leave
  const { data: leaves } = await supabase
    .from('doctor_leave_requests')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('status', 'approved')
    .lte('start_date', dateStr)
    .gte('end_date', dateStr);
    
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (leaves && leaves.some((l: any) => l.type === 'full_day')) {
    return { slots: [], message: 'Doctor is on leave.', slotDuration: schedule.slot_duration_minutes || 10 };
  }
  
  // 3. Get breaks
  const { data: breaks } = await supabase
    .from('doctor_schedule_breaks')
    .select('*')
    .eq('doctor_id', doctorId)
    .eq('day_of_week', dayOfWeek);
    
  // 4. Get active bookings
  const { data: bookings } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('doctor_id', doctorId)
    .eq('appointment_date', dateStr)
    .not('status', 'in', '("cancelled","no_show")');
    
  const slots: Slot[] = [];
  let currentSlot = parse(schedule.start_time, 'HH:mm:ss', targetDate);
  const endTime = parse(schedule.end_time, 'HH:mm:ss', targetDate);
  const slotDuration = schedule.slot_duration_minutes || 10;
  
  const nowInDhaka = toZonedTime(new Date(), 'Asia/Dhaka');
  let serial_no = 1;
  
  while (isBefore(currentSlot, endTime)) {
    const slotEnd = addMinutes(currentSlot, slotDuration);
    if (isBefore(endTime, slotEnd)) break;
    
    const slotStartStr = format(currentSlot, 'HH:mm:ss');
    const slotDisplay = format(currentSlot, 'h:mm a');
    
    // Check if in past
    const currentSlotZoned = toZonedTime(currentSlot, 'Asia/Dhaka');
    let isPast = false;
    if (dateStr === format(nowInDhaka, 'yyyy-MM-dd')) {
        if (isBefore(currentSlotZoned, nowInDhaka)) {
             isPast = true;
        }
    }

    // Check breaks
    let inBreak = false;
    for (const b of (breaks || [])) {
        if (slotStartStr >= b.start_time && slotStartStr < b.end_time) {
            inBreak = true;
            break;
        }
    }
    
    // Check bookings
    let isBooked = false;
    for (const b of (bookings || [])) {
        if (slotStartStr === b.start_time) {
            isBooked = true;
            break;
        }
    }
    
    // Check partial leave
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
        available: !inBreak && !isBooked && !inLeave && !isPast,
        serial_no: serial_no++
    });
    
    currentSlot = slotEnd;
  }
  
  return { slots, message: 'Success', slotDuration };
}
