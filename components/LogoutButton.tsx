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
    
    router.refresh() // Tell Next.js to re-render server components
    router.push('/') // Redirect
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
