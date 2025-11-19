import type { AppKitNetwork } from '@reown/appkit/networks'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { polygon, polygonAmoy } from '@reown/appkit/networks'

export const projectId = process.env.NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID

if (!projectId) {
  throw new Error('NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID is not defined')
}

const defaultAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://auth.forka.st'
const appIconUrl
  = process.env.NEXT_PUBLIC_APP_ICON ?? 'https://auth.forka.st/forkast-logo.svg'
const metamaskWalletId
  = 'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96'

export const networks = [polygon, polygonAmoy] as [AppKitNetwork, ...AppKitNetwork[]]
export const defaultNetwork = polygon

export const wagmiAdapter = new WagmiAdapter({
  ssr: false,
  projectId,
  networks,
})

export const wagmiConfig = wagmiAdapter.wagmiConfig

export const appKitMetadata = {
  name: 'Forkast Auth',
  description: 'Generate Forkast API credentials.',
  url: defaultAppUrl,
  icons: [
    appIconUrl,
    'https://forka.st/favicon.ico?favicon.71f60070.ico',
  ],
}

export const appKitThemeVariables = {
  '--w3m-font-family': 'var(--font-sans, Inter, sans-serif)',
  '--w3m-accent': '#16CAC2',
} as const

export const appKitFeatures = {
  analytics: process.env.NODE_ENV === 'production',
  connectorTypeOrder: [
    'injected',
    'walletConnect',
    'recent',
    'featured',
    'custom',
    'external',
    'recommended',
  ] as const,
  history: false,
  onramp: false,
  swaps: false,
  receive: true,
  send: true,
  reownAuthentication: false,
}

export const featuredWalletIds = [metamaskWalletId]
