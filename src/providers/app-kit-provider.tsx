'use client'

import type { AppKit } from '@reown/appkit/react'
import type { ReactNode } from 'react'
import { createAppKit } from '@reown/appkit/react'
import { useEffect, useState } from 'react'
import { WagmiProvider } from 'wagmi'
import { AppKitContext, defaultAppKitValue } from '@/hooks/useAppKit'
import {
  appKitFeatures,
  appKitMetadata,
  appKitThemeVariables,
  featuredWalletIds,
  networks,
  projectId,
  wagmiAdapter,
  wagmiConfig,
} from '@/lib/appkit'

let appKitInstance: AppKit | null = null

function isBrowser() {
  return typeof window !== 'undefined'
}

function getOrCreateAppKit() {
  if (!isBrowser()) {
    return null
  }
  if (appKitInstance) {
    return appKitInstance
  }

  try {
    appKitInstance = createAppKit({
      projectId: projectId!,
      adapters: [wagmiAdapter],
      networks,
      metadata: appKitMetadata,
      themeMode: 'dark',
      themeVariables: appKitThemeVariables,
      features: appKitFeatures,
      featuredWalletIds,
      defaultAccountTypes: { eip155: 'eoa' },
    })
    return appKitInstance
  }
  catch (error) {
    console.warn('Wallet initialization failed. Using local/default values.', error)
    return null
  }
}

export default function AppKitProvider({ children }: { children: ReactNode }) {
  const [appKitValue, setAppKitValue] = useState(defaultAppKitValue)

  useEffect(() => {
    const instance = getOrCreateAppKit()
    if (!instance) {
      return
    }

    setAppKitValue({
      open: async (options) => {
        await instance.open(options)
      },
      close: async () => {
        await instance.close()
      },
      isReady: true,
    })
  }, [])

  return (
    <WagmiProvider config={wagmiConfig}>
      <AppKitContext value={appKitValue}>
        {children}
      </AppKitContext>
    </WagmiProvider>
  )
}
