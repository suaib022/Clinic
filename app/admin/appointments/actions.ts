'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateAppointmentStatus(formData: FormData) {
    const id = formData.get('id') as string;
    const status = formData.get('status') as string;
    const supabase = await createClient();
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (error) {
        console.error('Update appointment status error:', error);
    }
    revalidatePath('/admin/appointments');
}
