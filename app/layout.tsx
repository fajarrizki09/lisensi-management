import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'License Dashboard',
  description: 'Manage ClipForge Licenses',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">ClipForge Admin</h1>
          <div className="flex gap-4">
            <span className="text-sm text-gray-500">Admin Mode</span>
          </div>
        </nav>
        <main className="p-6">
          {children}
        </main>
      </body>
    </html>
  )
}
