import { LoginForm } from '@/components/LoginForm'
import Link from 'next/link'

export const metadata = {
  title: 'Customer Login — Delivvr',
}

export default function CustomerLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-3xl font-extrabold text-primary-600">
            Delivvr
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            Customer sign in
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Browse restaurants and track your orders
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <LoginForm
            role="CUSTOMER"
            dashboardPath="/dashboard/customer"
            registerPath="/register/customer"
            accentColor="bg-primary-600"
            accentHover="hover:bg-primary-700"
            accentRing="focus:ring-primary-500"
          />
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Are you a restaurant?{' '}
          <Link
            href="/login/restaurant"
            className="font-medium text-primary-600 hover:underline"
          >
            Restaurant login
          </Link>
        </p>
      </div>
    </div>
  )
}
