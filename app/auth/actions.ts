'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// Simple secret for testing purposes
const SESSION_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key'

export async function patientLogin(formData: FormData) {
  const supabase = await createClient()
  
  const mobile = formData.get('mobile') as string
  const pin = formData.get('pin') as string

  // Find patient by mobile
  const { data: patient, error } = await supabase
    .from('patients')
    .select('id, pin')
    .eq('mobile_no', mobile)
    .single()

  if (error || !patient) {
    redirect(`/login?error=${encodeURIComponent('Invalid mobile number or PIN')}`)
  }
  
  // Note: in a real app, verify the hashed PIN. If raw:
  if (patient.pin !== pin) {
    redirect(`/login?error=${encodeURIComponent('Invalid mobile number or PIN')}`)
  }

  // Set session cookie
  const cookieStore = await cookies()
  cookieStore.set('patient_session', patient.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/'
  })

  revalidatePath('/', 'layout')
  redirect('/patient/dashboard')
}

export async function staffPinLogin(formData: FormData) {
  const supabase = await createClient()
  
  const identifier = formData.get('identifier') as string
  const pin = formData.get('pin') as string
  let role = formData.get('role') as string

  // For doctors, identifier is doctor_id
  let userId = null;
  
  if (role === 'doctor') {
    const { data: doctor, error } = await supabase
      .from('doctors')
      .select('id')
      .eq('doctor_id', identifier)
      .single()
      
    if (!error && doctor) {
      userId = doctor.id
    } else {
      // Fallback: Check if identifier is email in users table
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'doctor')
        .eq('email', identifier) // Note: Need to make sure email exists in users table, but usually it's doctor_id
        .single()
      if (user) userId = user.id
    }
  } else if (role === 'staff') {
    // Determine if it's admin or compounder from the users table
    const { data: user, error } = await supabase
      .from('users')
      .select('id, role')
      .in('role', ['admin', 'compounder'])
      .eq('email', identifier)
      .single()
      
    if (!error && user) {
      userId = user.id
      role = user.role // Update role to the actual one for cookie
    }
  }
  
  if (!userId) {
    redirect(`/login?error=${encodeURIComponent('User not found')}`)
  }
  
  // Verify PIN via RPC
  const { data: isValid, error: rpcError } = await supabase
    .rpc('verify_user_pin', { p_user_id: userId, p_pin: pin })
    
  if (rpcError || !isValid) {
    redirect(`/login?error=${encodeURIComponent('Invalid PIN')}`)
  }
  
  // Set session cookie
  const cookieStore = await cookies()
  cookieStore.set('staff_session', userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/'
  })
  cookieStore.set('staff_role', role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: '/'
  })

  revalidatePath('/', 'layout')
  const dashboardPath = role === 'admin' ? '/admin/dashboard' : `/${role}/dashboard`
  redirect(dashboardPath)
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    redirect(`/login?error=${encodeURIComponent(error?.message || 'Login failed')}`)
  }
  
  // Fetch user role
  const { data: userRecord } = await supabase.from('users').select('role').eq('id', data.user.id).single();
  const role = userRecord?.role || 'patient';

  revalidatePath('/', 'layout')
  
  if (role === 'admin') redirect('/admin/dashboard');
  if (role === 'doctor') redirect('/doctor/dashboard');
  if (role === 'compounder') redirect('/compounder/dashboard');
  redirect('/patient/dashboard');
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('name') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/login?message=Account created successfully. You can now log in.')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  // Clear custom role sessions
  const cookieStore = await cookies()
  cookieStore.delete('patient_session')
  cookieStore.delete('staff_session')
  cookieStore.delete('staff_role')
  cookieStore.delete('app_session')
  
  revalidatePath('/', 'layout')
  return { success: true }
}
