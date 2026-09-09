'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { salir } from '@/lib/acciones';

/** Orden en que aparecen las pestañas; cada rol ve solo las suyas. */
const ENLACES: { seccion: string; href: string; texto: string }[] = [
  { seccion: 'mi-ruta', href: '/mi-ruta', texto: 'Mi ruta' },
  { seccion: 'mesas', href: '/mesas', texto: 'Mesas' },
  { seccion: 'domicilios', href: '/domicilios', texto: 'Domicilios' },
  { seccion: 'domiciliarios', href: '/domiciliarios', texto: 'Domiciliarios' },
  { seccion: 'caja', href: '/caja', texto: 'Caja' },
  { seccion: 'usuarios', href: '/usuarios', texto: 'Personas' },
];

interface Props {
  nombre: string;
  rol: string;
  inicio: string;
  secciones: string[];
}

export function BarraNav({ nombre, rol, inicio, secciones }: Props) {
  const ruta = usePathname();
  const [pendiente, iniciar] = useTransition();

  const visibles = ENLACES.filter((e) => secciones.includes(e.seccion));

  return (
    <header className="sticky top-0 z-20 border-b border-borde bg-panel/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
        <Link href={inicio} className="mr-2 flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-marca text-black">
            ●
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {visibles.map((e) => {
            // Exacto o subruta: /domicilios no debe encender /domiciliarios.
            const activo = ruta === e.href || ruta.startsWith(`${e.href}/`);
            return (
              <Link
                key={e.href}
                href={e.href}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
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

        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold leading-tight">{nombre}</p>
          <p className="text-[11px] leading-tight text-suave">{rol}</p>
        </div>

        <button
          disabled={pendiente}
          onClick={() => iniciar(() => void salir())}
          className="shrink-0 rounded-lg border border-borde px-3 py-2 text-xs text-suave hover:border-alerta hover:text-alerta"
        >
          Salir
        </button>
      </div>
    </header>
  );
}
