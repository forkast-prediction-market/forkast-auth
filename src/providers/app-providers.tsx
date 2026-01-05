'use client'

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import AppKitProvider from '@/providers/app-kit-provider'

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <AppKitProvider>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-background text-foreground">
          {children}
        </div>
      </QueryClientProvider>
    </AppKitProvider>
  )
}
