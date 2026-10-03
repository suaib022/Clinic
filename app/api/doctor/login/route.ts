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

    // Resolve identifier to email using service client (bypasses RLS)
    // identifier could be email or doctor_id. If it's a compounder, they only have email in users table?
    // Wait, the migration mapped them to `doc-xxxxxx@staff.clinic.local` for doctors 
    // and `compounder_xxxxx@staff.clinic.local` for compounders.
    // If identifier doesn't contain '@', it might be a doctor_id.
    
    let emailToLogin = identifier.toLowerCase();
    
    if (!emailToLogin.includes('@')) {
        // Query users table joined with doctors
        const { data: doctorMatch } = await supabaseAdmin
            .from('users')
            .select('email, doctors!inner(doctor_id)')
            .eq('doctors.doctor_id', identifier)
            .single();
            
        if (doctorMatch?.email) {
            emailToLogin = doctorMatch.email;
        } else {
            // Log attempt and fail generic
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

    // Verify role
    const { data: userRecord } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .single();

    if (!userRecord || !['admin', 'doctor', 'compounder'].includes(userRecord.role)) {
        await supabase.auth.signOut();
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Success
    await clearAttempts(identifier, ip);
    return NextResponse.json({ success: true, user: { ...authData.user, role: userRecord.role } });
}
