/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  output: 'standalone',
  staticPageGenerationTimeout: 120,
  // serverComponentsExternalPackages ainda vive em `experimental` nesta
  // versão do Next (14.2.x) — vira estável (`serverExternalPackages`) só
  // em versões mais recentes. `recharts` foi removido da lista porque o
  // Next passou a detectá-lo automaticamente como pacote ESM que precisa
  // de transpilação, e mantê-lo aqui também gerava um erro de build
  // ("transpilePackages conflict with serverComponentsExternalPackages").
  experimental: {
    serverComponentsExternalPackages: ['socket.io-client']
  }
}

module.exports = nextConfig


