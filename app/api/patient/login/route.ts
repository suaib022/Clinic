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

    const cleanIdentifier = identifier.trim();
    let candidateEmails: string[] = [];

    if (cleanIdentifier.includes('@')) {
        candidateEmails.push(cleanIdentifier.toLowerCase());
    } else {
        // 1. Try exact UHID search first (case-insensitive)
        const { data: uhidMatches } = await supabaseAdmin
            .from('patients')
            .select('auth_user_id, email')
            .ilike('uhid', cleanIdentifier)
            .limit(1);

        if (uhidMatches && uhidMatches.length > 0 && uhidMatches[0].email) {
            candidateEmails.push(uhidMatches[0].email);
        } else {
            // 2. Try Mobile search with Bangladeshi country code prefixes
            let searchMobile = cleanIdentifier;
            if (/^01[3-9]\d{8}$/.test(cleanIdentifier)) {
                searchMobile = '+88' + cleanIdentifier;
            } else if (/^8801[3-9]\d{8}$/.test(cleanIdentifier)) {
                searchMobile = '+' + cleanIdentifier;
            }

            const { data: mobileMatches } = await supabaseAdmin
                .from('patients')
                .select('auth_user_id, email')
                .or(`mobile_no.eq.${searchMobile},mobile_no.eq.${cleanIdentifier}`);

            if (mobileMatches && mobileMatches.length > 0) {
                candidateEmails = mobileMatches.map(m => m.email).filter(Boolean) as string[];
            }
        }
    }

    if (candidateEmails.length === 0) {
        await logAttempt(identifier, ip);
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Attempt Supabase Auth login with candidate emails
    const supabase = await createClient();
    let authenticatedUser: any = null;

    for (const email of candidateEmails) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password: pin,
        });

        if (!authError && authData.user) {
            authenticatedUser = authData.user;
            break;
        }
    }

    if (!authenticatedUser) {
        await logAttempt(identifier, ip);
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Verify role is patient or create missing user record
    const { data: userRecord } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', authenticatedUser.id)
        .single();

    if (!userRecord) {
        await supabaseAdmin.from('users').insert({
            id: authenticatedUser.id,
            full_name: authenticatedUser.user_metadata?.full_name || 'Patient',
            email: authenticatedUser.email,
            role: 'patient'
        });
    } else if (userRecord.role !== 'patient') {
        await supabase.auth.signOut();
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Success
    await clearAttempts(identifier, ip);
    return NextResponse.json({
        success: true,
        user: { ...authenticatedUser, role: 'patient' }
    });
}
