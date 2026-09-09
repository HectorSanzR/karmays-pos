'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const enlaces = [
  { href: '/mesas', texto: 'Mesas' },
  { href: '/domicilios', texto: 'Domicilios' },
  { href: '/domiciliarios', texto: 'Domiciliarios' },
  { href: '/caja', texto: 'Caja' },
];

export function BarraNav() {
  const ruta = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-borde bg-panel/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
        <Link href="/" className="mr-3 flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-marca text-black">
            ●
          </span>
          <span className="hidden sm:inline">POS</span>
        </Link>

        <nav className="flex gap-1">
          {enlaces.map((e) => {
            // Exacto o subruta: /domicilios no debe encender /domiciliarios.
            const activo = ruta === e.href || ruta.startsWith(`${e.href}/`);
            return (
              <Link
                key={e.href}
                href={e.href}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activo
                    ? 'bg-marca text-black'
                    : 'text-suave hover:bg-panel2 hover:text-texto'
                }`}
              >
                {e.texto}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
