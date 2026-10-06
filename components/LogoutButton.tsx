'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsPending(true)
    // Use client-side Supabase to instantly clear cookies and local state
    const supabase = createClient()
    await supabase.auth.signOut()
    
    // Clear server-side custom cookies
    const { logout } = await import('@/app/auth/actions')
    await logout()
    
    // Use a hard navigation to clear Next.js client router cache and BFCache
    window.location.href = '/'
  }

  return (
    <a 
      href="#!" 
      onClick={handleLogout}
      style={{ opacity: isPending ? 0.5 : 1, cursor: isPending ? 'wait' : 'pointer' }}
    >
      {isPending ? 'Logging out...' : 'Logout'}
    </a>
  )
}
