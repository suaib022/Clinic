import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const speciality_id = searchParams.get('speciality_id');
  const supabase = await createClient();
  
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
