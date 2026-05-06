import { LoginForm } from '@/components/LoginForm'
import Link from 'next/link'

export const metadata = {
  title: 'Delivery Agent Login — Delivvr',
}

export default function AgentLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-3xl font-extrabold text-primary-600">
            Delivvr
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            Delivery Agent sign in
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            View your assigned pickups and deliveries
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <LoginForm
            role="AGENT"
            dashboardPath="/dashboard/agent"
            registerPath="/register/agent"
            accentColor="bg-green-600"
            accentHover="hover:bg-green-700"
            accentRing="focus:ring-green-500"
          />
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Are you a customer?{' '}
          <Link
            href="/login/customer"
            className="font-medium text-primary-600 hover:underline"
          >
            Customer login
          </Link>
        </p>
      </div>
    </div>
  )
}
