"use server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/requireRole";
import { revalidatePath } from "next/cache";

export async function addPatientToAccount(formData: FormData) {
  const { user } = await requireRole(['patient']);
  
  const full_name = formData.get('full_name') as string;
  const mobile_no = formData.get('mobile_no') as string;
  const gender = formData.get('gender') as string;
  const dob = formData.get('dob') as string;
  const title = formData.get('title') as string;
  const father_name = (formData.get('father_name') as string) || '';

  if (!full_name || !mobile_no || !gender || !dob) {
    throw new Error('Please fill all required fields');
  }

  const generatedUhid = `UHID${Math.floor(10000000 + Math.random() * 90000000)}`;

  // Also get the email from the current user account
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(user.id);

  const { error } = await supabaseAdmin.from('patients').insert({
    auth_user_id: user.id,
    uhid: generatedUhid,
    full_name,
    mobile_no,
    gender,
    dob,
    title,
    father_name,
    email: userData?.user?.email || null, // Shared email for the account
    address: '',
    country: 'Bangladesh',
    state: '',
    city: ''
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/patient/dashboard');
}
