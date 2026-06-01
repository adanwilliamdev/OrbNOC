/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // ⚠️ Ignorar erros de TypeScript durante o build
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignorar erros de lint durante o build
    ignoreDuringBuilds: true,
  },
  output: 'standalone',
}

module.exports = nextConfig