'use client'

import { RegisterForm } from '@/components/RegisterForm'
import Link from 'next/link'
import { useState } from 'react'

export default function RestaurantRegisterPage() {
  const [restaurantName, setRestaurantName] = useState('')
  const [restaurantAddress, setRestaurantAddress] = useState('')

  const extraFields = (
    <>
      <div>
        <label
          htmlFor="restaurantName"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Restaurant name
        </label>
        <input
          id="restaurantName"
          type="text"
          required
          value={restaurantName}
          onChange={(e) => setRestaurantName(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500 sm:text-sm"
          placeholder="My Great Restaurant"
        />
      </div>
      <div>
        <label
          htmlFor="restaurantAddress"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Restaurant address
        </label>
        <input
          id="restaurantAddress"
          type="text"
          required
          value={restaurantAddress}
          onChange={(e) => setRestaurantAddress(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500 sm:text-sm"
          placeholder="123 Main St, City"
        />
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-3xl font-extrabold text-primary-600">
            Delivvr
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            Register your restaurant
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Start accepting orders on Delivvr
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <RegisterForm
            role="RESTAURANT"
            loginPath="/login/restaurant"
            dashboardPath="/dashboard/restaurant"
            extraFields={extraFields}
            onExtraData={() => ({
              restaurantName,
              restaurantAddress,
            })}
          />
        </div>
      </div>
    </div>
  )
}
