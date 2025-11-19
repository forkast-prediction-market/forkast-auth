import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import { AppProviders } from '@/providers/app-providers'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Forkast API Key Generator',
  description:
    'Connect your wallet to mint Forkast API credentials and manage keys in seconds.',
  icons: {
    icon: '/forkast-logo.svg',
    shortcut: '/forkast-logo.svg',
    apple: '/forkast-logo.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
