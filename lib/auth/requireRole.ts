import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';

export async function requireRole(allowedRoles: string[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const { data: userRecord } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!userRecord || !allowedRoles.includes(userRecord.role)) {
        // Redirect to their own dashboard
        const role = userRecord?.role || 'patient';
        if (role === 'admin') redirect('/admin/dashboard');
        if (role === 'doctor') redirect('/doctor/dashboard');
        if (role === 'compounder') redirect('/compounder/dashboard');
        if (role === 'patient') redirect('/patient/dashboard');
        redirect('/login');
    }

    let patientId = null;
    if (userRecord.role === 'patient') {
        const { data: p } = await supabaseAdmin.from('patients').select('id').eq('auth_user_id', user.id).single();
        patientId = p?.id;
    }

    return { user, role: userRecord.role, patientId };
}
