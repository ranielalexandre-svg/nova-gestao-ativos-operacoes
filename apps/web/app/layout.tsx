import type { Metadata } from 'next';
import { AssetReloadGuard } from '@/components/asset-reload-guard';
import './globals.css';
import './nova-design-system.css';

export const metadata: Metadata = {
  title: 'NOVA',
  description: 'NOVA Gestão de Ativos e Operações',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning><body><AssetReloadGuard />
        {children}
      </body></html>
  );
}
