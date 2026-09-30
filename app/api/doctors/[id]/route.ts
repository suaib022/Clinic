import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  
  // Get doctor info
  const { data: doc, error: docError } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')
    .eq('id', id)
    .single();
    
  if (docError) return NextResponse.json({ error: docError.message }, { status: 404 });
  
  // Get specialities
  const { data: specs } = await supabase
    .from('doctor_specialities')
    .select('speciality_id, specialities(name)')
    .eq('doctor_id', id);
  const specialityNames = specs?.map(s => (s.specialities as any).name).join(', ') || '';
  const speciality_id = specs && specs.length > 0 ? specs[0].speciality_id : null;
  
  // Get schedules
  const { data: schedules } = await supabase
    .from('doctor_schedules')
    .select('*')
    .eq('doctor_id', id)
    .eq('is_active', true)
    .order('day_of_week');
    
  return NextResponse.json({
    ...doc,
    speciality: specialityNames,
    speciality_id: speciality_id,
    schedules: schedules || [],
    consultation_fee: 1200 // Mocking fee for now as requested
  });
}
