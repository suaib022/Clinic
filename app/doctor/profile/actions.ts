'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/requireRole';

export async function updateProfile(formData: FormData) {
    const cookieStore = await cookies();
    const { user: { id: staffSession } } = await requireRole(['admin', 'doctor', 'compounder']);
    
    if (!staffSession) {
        return { error: 'Not authenticated' };
    }

    const fullName = formData.get('full_name') as string;
    const email = formData.get('email') as string;
    const consultationFee = formData.get('consultation_fee') as string;

    const supabase = await createClient();

    // Update users table
    const { error: userError } = await supabase
        .from('users')
        .update({ full_name: fullName, email: email })
        .eq('id', staffSession);

    if (userError) return { error: userError.message };

    // Update doctors table
    if (consultationFee) {
        const { error: doctorError } = await supabase
            .from('doctors')
            .update({ consultation_fee: parseFloat(consultationFee) })
            .eq('id', staffSession);
            
        if (doctorError) return { error: doctorError.message };
    }

    revalidatePath('/doctor/profile');
    return { success: true };
}

export async function changePin(formData: FormData) {
    const cookieStore = await cookies();
    const { user: { id: staffSession } } = await requireRole(['admin', 'doctor', 'compounder']);
    
    if (!staffSession) {
        return { error: 'Not authenticated' };
    }

    const currentPin = formData.get('current_pin') as string;
    const newPin = formData.get('new_pin') as string;
    const confirmPin = formData.get('confirm_pin') as string;

    if (newPin !== confirmPin) {
        return { error: 'New PINs do not match' };
    }
    
    if (newPin.length < 4) {
        return { error: 'PIN must be at least 4 characters long' };
    }

    const supabase = await createClient();

    // Verify current PIN
    const { data: isValid, error: verifyError } = await supabase
        .rpc('verify_user_pin', { p_user_id: staffSession, p_pin: currentPin });
        
    if (verifyError || !isValid) {
        return { error: 'Current PIN is incorrect' };
    }

    // Update PIN
    const { data: isUpdated, error: updateError } = await supabase
        .rpc('update_user_pin', { p_user_id: staffSession, p_new_pin: newPin });

    if (updateError || !isUpdated) {
        return { error: 'Failed to update PIN. Make sure you have run the update_user_pin RPC migration.' };
    }

    return { success: true };
}
