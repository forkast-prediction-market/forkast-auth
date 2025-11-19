'use client';

import { createConfig, http } from 'wagmi';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';
import { polygon, polygonAmoy } from 'wagmi/chains';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import type { AppKitNetwork } from '@reown/appkit/networks';
import {
  polygon as appKitPolygon,
  polygonAmoy as appKitPolygonAmoy,
} from '@reown/appkit/networks';
import { createAppKit } from '@reown/appkit/react';

const walletConnectProjectId = process.env.NEXT_PUBLIC_REOWN_APPKIT_PROJECT_ID;
const defaultAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://auth.forka.st';
const appIconUrl =
  process.env.NEXT_PUBLIC_APP_ICON ??
  'https://auth.forka.st/forkast-logo.svg';
const metamaskWalletId =
  'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96';
const connectorTypeOrder = [
  'injected',
  'walletConnect',
  'recent',
  'featured',
  'custom',
  'external',
  'recommended',
] as const;
const sharedFeatures = {
  analytics: process.env.NODE_ENV === 'production',
  connectorTypeOrder: [...connectorTypeOrder],
  history: false,
  onramp: false,
  swaps: false,
  receive: true,
  send: true,
  reownAuthentication: false,
};

const metadata = {
  name: 'Forkast Auth',
  description: 'Generate Forkast API credentials.',
  url: defaultAppUrl,
  icons: [
    appIconUrl,
    'https://forka.st/favicon.ico?favicon.71f60070.ico',
  ],
};

const makeBaseConnectors = () => [
  injected({
    shimDisconnect: true,
  }),
  coinbaseWallet({
    appName: 'Forkast Auth',
    appLogoUrl: appIconUrl,
    preference: 'all',
    enableMobileWalletLink: true,
    reloadOnDisconnect: true,
  }),
];

const appKitNetworks = walletConnectProjectId
  ? ([appKitPolygon, appKitPolygonAmoy] as [AppKitNetwork, ...AppKitNetwork[]])
  : null;

const wagmiAdapter = walletConnectProjectId
  ? new WagmiAdapter({
      projectId: walletConnectProjectId,
      networks: appKitNetworks!,
      ssr: false,
      connectors: makeBaseConnectors(),
    })
  : null;

const fallbackConfig = createConfig({
  chains: [polygon, polygonAmoy],
  transports: {
    [polygon.id]: http(),
    [polygonAmoy.id]: http(),
  },
  connectors: [
    ...makeBaseConnectors(),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            showQrModal: true,
            metadata,
            qrModalOptions: {
              themeMode: 'dark',
              themeVariables: {
                '--wcm-z-index': '9999',
              },
            },
          }),
        ]
      : []),
  ],
  multiInjectedProviderDiscovery: false,
});

export const wagmiConfig = wagmiAdapter?.wagmiConfig ?? fallbackConfig;
export const isAppKitEnabled = Boolean(wagmiAdapter);

let appKitInstance: ReturnType<typeof createAppKit> | null = null;

export function ensureAppKit() {
  if (!wagmiAdapter || !appKitNetworks || !walletConnectProjectId) {
    return null;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  if (appKitInstance) {
    return appKitInstance;
  }
  appKitInstance = createAppKit({
    projectId: walletConnectProjectId,
    adapters: [wagmiAdapter],
    networks: appKitNetworks,
    metadata,
    themeMode: 'dark',
    themeVariables: {
      '--w3m-font-family': 'var(--font-sans, Inter, sans-serif)',
      '--w3m-accent': '#16CAC2',
    },
    features: sharedFeatures,
    featuredWalletIds: [metamaskWalletId],
    defaultAccountTypes: { eip155: 'eoa' },
  });

  void appKitInstance
    .getUniversalProvider()
    .then(async (provider) => {
      const core = provider?.client?.core as
        | {
            start?: () => Promise<void>;
            relayer?: {
              publish?: (...args: unknown[]) => unknown;
              publishCustom?: (...args: unknown[]) => unknown;
            };
          }
        | undefined;

      if (!core) {
        return;
      }

      try {
        if (typeof core.start === 'function') {
          await core.start();
        }
      } catch {
        // ignore core startup issues; AppKit retries internally
      }

      const relayer = core.relayer;
      if (relayer && typeof relayer.publishCustom !== 'function' && typeof relayer.publish === 'function') {
        relayer.publishCustom = (...args: unknown[]) => relayer.publish?.(...args);
      }
    })
    .catch(() => {
      // swallow provider init issues; AppKit handles reconnection internally
    });

  return appKitInstance;
}
