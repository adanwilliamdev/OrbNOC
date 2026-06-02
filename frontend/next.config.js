/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  output: 'standalone',
  staticPageGenerationTimeout: 120,
  // Forçar todas as páginas como client components
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ['recharts', 'socket.io-client']
  },
  // Desabilitar geração estática
  generateBuildId: async () => 'build',
  distDir: '.next'
}

module.exports = nextConfig