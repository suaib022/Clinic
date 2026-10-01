import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const q = searchParams.get('q');

    if (!type || !q) {
        return NextResponse.json({ error: 'Missing type or q parameter' }, { status: 400 });
    }

    const supabase = await createClient();

    let query = supabase.from('patients').select('*');
    if (type === 'mobile') {
        query = query.eq('mobile_no', q);
    } else if (type === 'uhid') {
        query = query.eq('uhid', q);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ patients: data || [] });
}
