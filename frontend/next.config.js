/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  output: 'standalone',
  staticPageGenerationTimeout: 120,
  // Remove appDir - é obsoleto no Next.js 14
  experimental: {
    serverComponentsExternalPackages: ['recharts', 'socket.io-client']
  }
}

module.exports = nextConfig