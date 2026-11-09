import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const speciality_id = searchParams.get('speciality_id');
  const supabase = await createClient();
  
  if (speciality_id) {
    // Join via doctor_specialities
    const { data, error } = await supabase
      .from('doctor_specialities')
      .select('users!inner(id, full_name, avatar_url)')
      .eq('speciality_id', speciality_id);
      
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Deduplicate and sort by full_name
    const map = new Map<string, any>();
    data.forEach((d: any) => {
      const u = d.users;
      if (u && u.id && !map.has(u.id)) {
        map.set(u.id, u);
      }
    });

    const doctors = Array.from(map.values()).sort((a, b) => 
      (a.full_name || '').localeCompare(b.full_name || '')
    );

    return NextResponse.json(doctors);
  } else {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, avatar_url')
      .eq('role', 'doctor')
      .order('full_name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
}
