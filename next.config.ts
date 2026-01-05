import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  typedRoutes: true,
  env: {
    CLOB_URL: 'https://clob.kuest.com',
    RELAYER_URL: 'https://relayer.kuest.com',
  },
}

export default nextConfig
