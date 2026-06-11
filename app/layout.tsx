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
      <body className="min-h-screen bg-slate-950 text-slate-900 antialiased">
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}
