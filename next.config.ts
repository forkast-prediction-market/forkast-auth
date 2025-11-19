import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  typedRoutes: true,
  env: {
    CLOB_URL: 'https://clob.forka.st',
  },
}

export default nextConfig
