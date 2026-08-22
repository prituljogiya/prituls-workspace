import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { TimerProvider } from '@/contexts/TimerContext'
import { PermissionProvider } from '@/contexts/PermissionContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "Pritul's workspace",
  description: 'A comprehensive project management tool with Trello and Jira features',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <PermissionProvider>
              <TimerProvider>{children}</TimerProvider>
            </PermissionProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

