'use client';

import { createConfig, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { polygon, polygonAmoy } from 'wagmi/chains';

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [polygon, polygonAmoy],
  transports: {
    [polygon.id]: http(),
    [polygonAmoy.id]: http(),
  },
  connectors: [
    injected({
      shimDisconnect: true,
    }),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            showQrModal: true,
            metadata: {
              name: 'Forkast Auth',
              description: 'Generate Forkast API credentials.',
              url: 'https://forka.st',
              icons: ['https://forka.st/favicon.ico?favicon.71f60070.ico'],
            },
          }),
        ]
      : []),
  ],
  multiInjectedProviderDiscovery: false,
});
