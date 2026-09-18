'use client';

import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <title>OrbNOC - Network Operations Center</title>
        <meta name="description" content="Plataforma de monitoramento de infraestrutura em tempo real" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
