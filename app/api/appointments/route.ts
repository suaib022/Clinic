import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { addMinutes, parse, format } from "date-fns";
import { toZonedTime } from 'date-fns-tz';
import { generateSlots } from "@/lib/slots";

export async function POST(request: Request) {
  const body = await request.json();
  const { doctor_id, appointment_date, start_time, patientType, patientData, oldPatientId } = body;
  
  if (!doctor_id || !appointment_date || !start_time) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  
  let finalPatientId = oldPatientId;
  let generatedUhid = null;
  let generatedPin = null;

  if (patientType === 'NEW') {
      if (!/^\+8801[3-9]\d{8}$/.test(patientData.mobile_no)) {
          return NextResponse.json({ error: 'Please enter a valid Bangladeshi mobile number starting with +8801' }, { status: 400 });
      }
      if (patientData.dob) {
          const today = new Date().toISOString().split('T')[0];
          if (patientData.dob >= today) {
              return NextResponse.json({ error: 'Date of birth must be a past date' }, { status: 400 });
          }
      }

      generatedUhid = `UHID${Math.floor(10000000 + Math.random() * 90000000)}`;
      generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
      
      const email = patientData.email || `${generatedUhid.toLowerCase()}@patients.clinic.local`;

      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: generatedPin,
          email_confirm: true,
          user_metadata: { full_name: patientData.full_name }
      });

      if (authError || !authUser.user) {
          return NextResponse.json({ error: authError?.message || 'Error creating user' }, { status: 500 });
      }

      const { data: newPatient, error: patientError } = await supabaseAdmin.from('patients').insert({
          auth_user_id: authUser.user.id,
          uhid: generatedUhid,
          title: patientData.title,
          full_name: patientData.full_name,
          father_name: patientData.father_name,
          gender: patientData.gender,
          dob: patientData.dob,
          mobile_no: patientData.mobile_no,
          email: email,
          address: patientData.address,
          country: patientData.country,
          state: patientData.state,
          city: patientData.city
      }).select().single();
      
      if (patientError) {
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          return NextResponse.json({ error: patientError.message }, { status: 500 });
      }
      
      finalPatientId = newPatient.id;
  }
  
  // Rate limiting for appointments based on patient_id
  if (finalPatientId) {
      const today = format(toZonedTime(new Date(), 'Asia/Dhaka'), 'yyyy-MM-dd');
      const { data: existingAppts } = await supabaseAdmin
          .from('appointments')
          .select('id')
          .eq('patient_id', finalPatientId)
          .gte('created_at', today);
          
      if (existingAppts && existingAppts.length >= 3) {
          return NextResponse.json({ error: 'You have reached the maximum number of appointments for today' }, { status: 429 });
      }
  }

  // 1. Generate slots to validate and get serial_no
  const { slots, slotDuration } = await generateSlots(supabaseAdmin, doctor_id, appointment_date);
  const targetSlot = slots.find(s => s.start_time === start_time);
  
  if (!targetSlot) {
      return NextResponse.json({ error: 'Invalid slot time' }, { status: 422 });
  }
  if (!targetSlot.available) {
      return NextResponse.json({ error: 'Slot already taken or unavailable' }, { status: 409 });
  }

  const startTimeParsed = parse(start_time, 'HH:mm:ss', new Date());
  const endTimeParsed = addMinutes(startTimeParsed, slotDuration);
  const end_time = format(endTimeParsed, 'HH:mm:ss');
  const scheduled_start = `${appointment_date}T${start_time}+06:00`;

  // 2. Call the RPC function
  const { data, error } = await supabaseAdmin.rpc('create_appointment', {
      p_patient_id: finalPatientId || null,
      p_doctor_id: doctor_id,
      p_appointment_date: appointment_date,
      p_start_time: start_time,
      p_end_time: end_time,
      p_serial_no: targetSlot.serial_no,
      p_scheduled_start: scheduled_start,
      p_slot_minutes: slotDuration,
      p_visit_type: 'new'
  });
  
  if (error) {
      if (error.message.includes('already booked')) {
          return NextResponse.json({ error: 'Slot just taken, pick another' }, { status: 409 });
      }
      if (error.code === '23505') { // Unique constraint idx_patient_one_appt_per_doc_date
          return NextResponse.json({ error: 'You already have an active appointment with this doctor on this date' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ 
      success: true, 
      appointment: data,
      uhid: generatedUhid,
      pin: generatedPin
  });
}
