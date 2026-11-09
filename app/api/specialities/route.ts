import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  
  // Fetch active clinical specialities that have at least one doctor linked
  const { data, error } = await supabase
    .from('doctor_specialities')
    .select('speciality_id, specialities!inner(id, name)');
    
  if (error || !data || data.length === 0) {
    // Fallback to all specialities if join fails
    const { data: allSpecs, error: fallbackErr } = await supabase.from('specialities').select('id, name').order('name');
    if (fallbackErr) return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
    return NextResponse.json(allSpecs);
  }

  // Deduplicate specialities and sort alphabetically
  const uniqueMap = new Map<string, { id: string; name: string }>();
  data.forEach((item: any) => {
    const s = item.specialities;
    if (s && s.id && s.name && !uniqueMap.has(s.id)) {
      uniqueMap.set(s.id, { id: s.id, name: s.name });
    }
  });

  const specialities = Array.from(uniqueMap.values()).sort((a, b) => 
    a.name.localeCompare(b.name)
  );

  return NextResponse.json(specialities);
}
