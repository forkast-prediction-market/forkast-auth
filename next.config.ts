import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  typedRoutes: true,
  env: {
    CLOB_URL: 'https://clob.forka.st',
    RELAYER_URL: 'https://relayer.forka.st',
  },
}

export default nextConfig
