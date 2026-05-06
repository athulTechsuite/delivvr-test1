import { LoginForm } from '@/components/LoginForm'
import Link from 'next/link'

export const metadata = {
  title: 'Restaurant Login — Delivvr',
}

export default function RestaurantLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-3xl font-extrabold text-primary-600">
            Delivvr
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            Restaurant sign in
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your menu and incoming orders
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <LoginForm
            role="RESTAURANT"
            dashboardPath="/dashboard/restaurant"
            registerPath="/register/restaurant"
            accentColor="bg-amber-600"
            accentHover="hover:bg-amber-700"
            accentRing="focus:ring-amber-500"
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
