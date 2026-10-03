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
    <>
      <li className="d-xl-none"><a href="/dashboard">Dashboard</a></li>
      <li className="d-none d-xl-block ms-2">
         <a href="/dashboard" className="btn text-white px-4 py-2" style={{ backgroundColor: '#0ab1a9', borderRadius: '50px', fontSize: '14px', fontWeight: '500' }}>Dashboard</a>
      </li>
      <li className="ms-2">
        <LogoutButton />
      </li>
    </>
  )
}
