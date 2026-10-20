import type { NextConfig } from 'next';

// Em produção o Caddy encaminha /api e /ws para o backend (mesma origem). Este rewrite existe só
// para `next dev` sem Caddy: defina BACKEND_URL (ex.: http://localhost:8000) ao subir o dev server.
const backend = process.env.BACKEND_URL;

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async rewrites() {
    return backend ? [{ source: '/api/:path*', destination: `${backend}/api/:path*` }] : [];
  },
};

export default config;
