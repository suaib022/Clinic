'use client'

import { useAuth } from '@/components/AuthProvider'
import LogoutButton from '@/components/LogoutButton'

export default function HeaderAuthLinks() {
  const { user, isLoading } = useAuth()

  // Prevent hydration mismatch or layout shift by showing the default links while loading
  if (isLoading || !user) {
    return (
      <>
        <li><a href="/login">Login</a></li>
        <li><a href="/signup">Sign Up</a></li>
      </>
    )
  }

  return (
    <li>
      <LogoutButton />
    </li>
  )
}
