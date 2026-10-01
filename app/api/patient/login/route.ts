import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    const { identifier, pin } = await request.json(); // identifier can be mobile_no or email

    if (!identifier || !pin) {
        return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const supabase = await createClient();

    // Find the patient by mobile or email and PIN
    const { data: patient, error } = await supabase
        .from('patients')
        .select('*')
        .or(`mobile_no.eq.${identifier},email.eq.${identifier}`)
        .eq('pin', pin)
        .single();

    if (error || !patient) {
        return NextResponse.json({ error: 'Invalid phone/email or PIN' }, { status: 401 });
    }

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('patient_session', patient.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    return NextResponse.json({ success: true, patient });
}
