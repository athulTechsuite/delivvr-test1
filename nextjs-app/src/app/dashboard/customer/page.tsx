import { LogoutButton } from '@/components/LogoutButton'
import { CustomerDashboardContent } from '@/components/customer/CustomerDashboardContent'

export const metadata = {
  title: 'Customer Dashboard — Delivvr',
}

export default function CustomerDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold text-primary-600">Delivvr</h1>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-gray-500 sm:block">
              Customer Dashboard
            </span>
            <LogoutButton loginPath="/login/customer" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <CustomerDashboardContent />
      </main>
    </div>
  )
}
