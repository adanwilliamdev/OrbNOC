/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  output: 'standalone',
  staticPageGenerationTimeout: 120,
  // Remova a linha 'appDir' - ela é obsoleta no Next.js 14
  experimental: {
    serverComponentsExternalPackages: ['recharts', 'socket.io-client']
  }
}

module.exports = nextConfig