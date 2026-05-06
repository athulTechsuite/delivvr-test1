'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface LogoutButtonProps {
  loginPath: string
}

export function LogoutButton({ loginPath }: LogoutButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push(loginPath)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-60"
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
