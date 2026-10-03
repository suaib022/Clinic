import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { checkRateLimit, logAttempt, clearAttempts } from '@/lib/auth/rateLimit';

export async function POST(request: Request) {
    const { identifier, pin } = await request.json();

    if (!identifier || !pin) {
        return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

    // Rate limiting
    const allowed = await checkRateLimit(identifier, ip);
    if (!allowed) {
        return NextResponse.json({ error: 'Too many failed attempts. Try again later.' }, { status: 429 });
    }

    // Resolve identifier to email using service client
    let emailToLogin = identifier.toLowerCase();
    
    if (!emailToLogin.includes('@')) {
        // Query users table joined with patients
        // Identifier could be mobile_no or uhid
        const { data: patientMatch } = await supabaseAdmin
            .from('patients')
            .select('auth_user_id, email')
            .or(`mobile_no.eq.${identifier},uhid.eq.${identifier}`)
            .single();
            
        if (patientMatch?.email) {
            emailToLogin = patientMatch.email;
        } else {
            // Log attempt and fail
            await logAttempt(identifier, ip);
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }
    }

    // Now attempt Auth with the resolved email
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailToLogin,
        password: pin,
    });

    if (authError || !authData.user) {
        await logAttempt(identifier, ip);
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify role is patient
    const { data: userRecord } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .single();

    if (!userRecord || userRecord.role !== 'patient') {
        await supabase.auth.signOut();
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Success
    await clearAttempts(identifier, ip);
    return NextResponse.json({ success: true, user: { ...authData.user, role: userRecord.role } });
}
