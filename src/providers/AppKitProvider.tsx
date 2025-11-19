'use client'

import type { AppKit } from '@reown/appkit'
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

    void warmUniversalProvider(appKitInstance)
    return appKitInstance
  }
  catch (error) {
    console.warn('Wallet initialization failed. Using local/default values.', error)
    return null
  }
}

async function warmUniversalProvider(instance: AppKit) {
  try {
    const provider = await instance.getUniversalProvider()
    const core = provider?.client?.core as
      | {
        start?: () => Promise<void>
        relayer?: {
          publish?: (...args: unknown[]) => unknown
          publishCustom?: (...args: unknown[]) => unknown
        }
      }
      | undefined

    if (!core) {
      return
    }

    if (typeof core.start === 'function') {
      await core.start().catch(() => {})
    }

    const relayer = core.relayer
    if (relayer && typeof relayer.publishCustom !== 'function' && typeof relayer.publish === 'function') {
      relayer.publishCustom = (...args: unknown[]) => relayer.publish?.(...args)
    }
  }
  catch {
    // swallow provider init issues; AppKit handles reconnection internally
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
