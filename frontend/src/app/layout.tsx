import './globals.css';
import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import { QueryProvider } from '@/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'OrbNOC - Network Operations Center',
  description: 'Plataforma de monitoramento de infraestrutura em tempo real',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="font-sans antialiased">
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
