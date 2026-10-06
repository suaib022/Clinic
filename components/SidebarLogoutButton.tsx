'use client'

import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

export default function SidebarLogoutButton() {
    const [isPending, setIsPending] = useState(false)

    const handleLogout = async () => {
        setIsPending(true)
        const supabase = createClient()
        await supabase.auth.signOut() // clears client-side state
        const { logout } = await import('@/app/auth/actions')
        await logout() // clears server-side custom cookies
        
        // Use a hard navigation to clear Next.js client router cache and BFCache
        // This ensures the back button cannot show the private page after logout
        window.location.href = '/'
    }

    return (
        <button 
            onClick={handleLogout} 
            disabled={isPending} 
            className="btn btn-light w-100 text-start d-flex align-items-center text-danger p-3 rounded-3 hover-bg-light-danger fw-medium" 
            style={{ gap: '12px' }}
        >
            <i className="bi bi-box-arrow-right fs-5"></i>
            <span>{isPending ? 'Logging out...' : 'Logout'}</span>
        </button>
    )
}
