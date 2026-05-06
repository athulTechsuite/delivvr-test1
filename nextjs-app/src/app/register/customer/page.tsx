import { RegisterForm } from '@/components/RegisterForm'
import Link from 'next/link'

export const metadata = {
  title: 'Customer Registration — Delivvr',
}

export default function CustomerRegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-3xl font-extrabold text-primary-600">
            Delivvr
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            Create a customer account
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Start ordering from local restaurants
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <RegisterForm
            role="CUSTOMER"
            loginPath="/login/customer"
            dashboardPath="/dashboard/customer"
          />
        </div>
      </div>
    </div>
  )
}
