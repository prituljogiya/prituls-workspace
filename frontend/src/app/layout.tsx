import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { TimerProvider } from '@/contexts/TimerContext'

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
            <TimerProvider>{children}</TimerProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

