import type { Metadata, Viewport } from 'next'

import { AppProviders } from '@/providers/app-providers'
import { openSauceOne } from '@/lib/fonts'

import './globals.css'

export const metadata: Metadata = {
  title: 'Kuest API Key Generator',
  description:
    'Connect your wallet to mint Kuest API credentials and manage keys in seconds.',
  icons: {
    icon: '/kuest-logo.svg',
    shortcut: '/kuest-logo.svg',
    apple: '/kuest-logo.svg',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1e293b' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${openSauceOne.variable} dark`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
