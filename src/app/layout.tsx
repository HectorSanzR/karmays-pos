import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BarraNav } from '@/components/BarraNav';

export const metadata: Metadata = {
  title: 'POS Restaurante',
  description: 'Mesas, domicilios y recaudo',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0e1116',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <BarraNav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
