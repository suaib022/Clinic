import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { addMinutes, parse, format } from "date-fns";

export async function POST(request: Request) {
  const supabase = await createClient();
  
  const body = await request.json();
  const { doctor_id, appointment_date, start_time, patientType, patientData, oldPatientId } = body;
  
  if (!doctor_id || !appointment_date || !start_time) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  
  // Calculate end_time (assume 10 mins for now, in a real app query doctor_schedules)
  const startTimeParsed = parse(start_time, 'HH:mm:ss', new Date());
  const endTimeParsed = addMinutes(startTimeParsed, 10);
  const end_time = format(endTimeParsed, 'HH:mm:ss');
  
  let finalPatientId = oldPatientId;
  let generatedUhid = null;
  let generatedPin = null;

  if (patientType === 'NEW') {
      generatedUhid = `UHID${Math.floor(10000000 + Math.random() * 90000000)}`;
      generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
      
      const { data: newPatient, error: patientError } = await supabase.from('patients').insert({
          uhid: generatedUhid,
          pin: generatedPin,
          title: patientData.title,
          full_name: patientData.full_name,
          father_name: patientData.father_name,
          gender: patientData.gender,
          dob: patientData.dob,
          mobile_no: patientData.mobile_no,
          email: patientData.email,
          address: patientData.address,
          country: patientData.country,
          state: patientData.state,
          city: patientData.city
      }).select().single();
      
      if (patientError) {
          return NextResponse.json({ error: patientError.message }, { status: 500 });
      }
      
      finalPatientId = newPatient.id;
  }
  
  // Insert with unique constraint handling
  const { data, error } = await supabase.from('appointments').insert({
      patient_id: finalPatientId || null,
      doctor_id,
      appointment_date,
      start_time,
      end_time,
      status: 'hold'
  }).select().single();
  
  if (error) {
      if (error.code === '23505') { // Unique constraint violation
          return NextResponse.json({ error: 'Slot just taken, pick another' }, { status: 409 });
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

