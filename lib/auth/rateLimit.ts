import { supabaseAdmin } from '@/lib/supabase/admin';

export async function checkRateLimit(identifier: string, ip: string) {
    const { data, error } = await supabaseAdmin
        .from('login_attempts')
        .select('id')
        .eq('identifier', identifier)
        .eq('ip_address', ip)
        .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());
    
    if (!error && data && data.length >= 5) {
        return false; // rate limited
    }
    return true; // allowed
}

export async function logAttempt(identifier: string, ip: string) {
    await supabaseAdmin.from('login_attempts').insert({
        identifier,
        ip_address: ip
    });
}

export async function clearAttempts(identifier: string, ip: string) {
    await supabaseAdmin
        .from('login_attempts')
        .delete()
        .eq('identifier', identifier)
        .eq('ip_address', ip);
}
