'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  session: Session | null
  isLoading: boolean
  role: string
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  role: 'guest',
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // We use the browser client which automatically handles token refresh and cookie management
  const supabase = createClient()

  useEffect(() => {
    // 1. Fetch the initial session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
      
      // Real-time protection: if session is gone and we are on a private route, kick to login
      if (!session) {
        const path = window.location.pathname
        const isProtectedRoute = ['/admin', '/doctor', '/compounder', '/patient'].some(
          prefix => path === prefix || path.startsWith(`${prefix}/`)
        )
        if (isProtectedRoute) {
          window.location.href = '/login'
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  // Extract role. If logged in, defaults to 'user'. 
  // You can also access custom claims via user.user_metadata.role if you set them in the future.
  const role = user ? (user.user_metadata?.role || 'user') : 'guest'

  return (
    <AuthContext.Provider value={{ user, session, isLoading, role }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook to easily access auth state from any client component
export const useAuth = () => useContext(AuthContext)
