/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  output: 'standalone',
  // Desabilitar geração estática para todas as rotas
  staticPageGenerationTimeout: 120,
  // Configuração para rotas dinâmicas
  experimental: {
    appDir: true,
  },
}

module.exports = nextConfig
