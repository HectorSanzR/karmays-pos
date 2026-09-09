import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BarraNav } from '@/components/BarraNav';
import { PERMISOS, usuarioActual } from '@/lib/sesion';

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await usuarioActual();
  const permiso = usuario ? PERMISOS[usuario.rol] : null;

  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {usuario && permiso && (
          <BarraNav
            nombre={usuario.nombre}
            rol={permiso.etiqueta}
            inicio={permiso.inicio}
            secciones={permiso.secciones}
          />
        )}
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
