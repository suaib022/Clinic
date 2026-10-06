import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const q = searchParams.get('q');

    if (!type || !q) {
        return NextResponse.json({ error: 'Missing type or q parameter' }, { status: 400 });
    }

    let query = supabaseAdmin.from('patients').select('id, full_name, uhid, mobile_no, gender, email');
    if (type === 'mobile') {
        let mobileQ = q;
        if (/^01[3-9]\d{8}$/.test(q)) {
            mobileQ = '+88' + q;
        } else if (/^8801[3-9]\d{8}$/.test(q)) {
            mobileQ = '+' + q;
        }
        query = query.eq('mobile_no', mobileQ);
    } else if (type === 'uhid') {
        query = query.eq('uhid', q);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ patients: data || [] });
}
