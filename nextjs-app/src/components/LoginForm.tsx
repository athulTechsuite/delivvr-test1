'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface LoginFormProps {
  role: 'CUSTOMER' | 'RESTAURANT' | 'AGENT'
  dashboardPath: string
  registerPath: string
  accentColor: string
  accentHover: string
  accentRing: string
}

export function LoginForm({
  role,
  dashboardPath,
  registerPath,
  accentColor,
  accentHover,
  accentRing,
}: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      })

      const data = (await res.json()) as { ok?: boolean; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Login failed. Please check your credentials.')
        return
      }

      router.push(dashboardPath)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 sm:text-sm"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-full rounded-lg ${accentColor} px-4 py-3 text-sm font-semibold text-white shadow-sm transition ${accentHover} focus:outline-none focus:ring-2 ${accentRing} focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-center text-sm text-gray-500">
        Don&apos;t have an account?{' '}
        <Link
          href={registerPath}
          className="font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus:underline"
        >
          Register here
        </Link>
      </p>
    </form>
  )
}
