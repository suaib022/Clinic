import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { addMinutes, parse, format } from "date-fns";
import { toZonedTime } from 'date-fns-tz';

export async function POST(request: Request) {
  const body = await request.json();
  const { doctor_id, appointment_date, start_time, patientType, patientData, oldPatientId } = body;
  
  if (!doctor_id || !appointment_date || !start_time) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  
  const startTimeParsed = parse(start_time, 'HH:mm:ss', new Date());
  const endTimeParsed = addMinutes(startTimeParsed, 10);
  const end_time = format(endTimeParsed, 'HH:mm:ss');
  
  let finalPatientId = oldPatientId;
  let generatedUhid = null;
  let generatedPin = null;

  if (patientType === 'NEW') {
      // Basic rate limit check based on email/mobile could go here
      generatedUhid = `UHID${Math.floor(10000000 + Math.random() * 90000000)}`;
      generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
      
      const email = patientData.email || `${generatedUhid.toLowerCase()}@patients.clinic.local`;

      // 1. Create Auth User
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: generatedPin,
          email_confirm: true,
          user_metadata: { full_name: patientData.full_name }
      });

      if (authError || !authUser.user) {
          return NextResponse.json({ error: authError?.message || 'Error creating user' }, { status: 500 });
      }

      // 2. Set default role 'patient' in users table manually (if trigger doesn't)
      // The trigger 'on_auth_user_created' might already set role to 'patient', but let's be sure.
      
      // 3. Create Patient Record
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
          // Rollback auth user
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          return NextResponse.json({ error: patientError.message }, { status: 500 });
      }
      
      finalPatientId = newPatient.id;
  }
  
  // Rate limiting for appointments based on patient_id
  if (finalPatientId) {
      const { toZonedTime } = require('date-fns-tz');
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

  // Insert with unique constraint handling using supabaseAdmin to bypass RLS
  const { data, error } = await supabaseAdmin.from('appointments').insert({
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
