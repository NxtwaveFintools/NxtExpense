import type { NextConfig } from 'next'

import createBundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
  analyzerMode: 'json',
})

const nextConfig: NextConfig = {
  /* config options here */
}

export default withBundleAnalyzer(nextConfig)
