import type { Metadata } from 'next';
import { AssetReloadGuard } from '@/components/asset-reload-guard';
import './globals.css';

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
    <html lang="pt-BR">
      <head>
        <link
          id="nova-critical-css"
          rel="stylesheet"
          href="/nova-critical.css?v=20260417-visual-fix"
          media="all"
        />
      </head>
      <body>
        <AssetReloadGuard />
        {children}
      </body>
    </html>
  );
}
