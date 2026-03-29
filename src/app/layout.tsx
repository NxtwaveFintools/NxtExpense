import type { Metadata } from 'next'
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from 'next/font/google'

import { LenisProvider } from '@/components/ui/lenis-provider'
import { SonnerToaster } from '@/components/ui/sonner-toaster'
import { ThemeProvider } from '@/components/ui/theme-provider'
import { ReactQueryProvider } from '@/components/providers/react-query-provider'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: {
    default: 'NxtExpense',
    template: '%s | NxtExpense',
  },
  description: 'NxtExpense internal finance platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ReactQueryProvider>
            <LenisProvider />
            {children}
            <SonnerToaster />
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
