import type { Metadata } from 'next'
import './globals.css'
import { QueryProvider } from '@/components/QueryProvider'

export const metadata: Metadata = {
  title: 'Delivvr — Food Delivery',
  description: 'Order food from local restaurants',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
