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
  { seccion: 'historial', href: '/historial', texto: 'Historial' },
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

  const enlace = (e: (typeof ENLACES)[number]) => {
    // Exacto o subruta: /domicilios no debe encender /domiciliarios.
    const activo = ruta === e.href || ruta.startsWith(`${e.href}/`);
    return (
      <Link
        key={e.href}
        href={e.href}
        className={`rounded-lg px-3 py-2 text-sm font-semibold transition sm:px-4 ${
          activo ? 'bg-marca text-black' : 'text-suave hover:bg-panel2 hover:text-texto'
        }`}
      >
        {e.texto}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-20 border-b border-borde bg-panel/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2">
          <Link href={inicio} className="flex items-center font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-marca text-black">
              ●
            </span>
          </Link>

          {/* En pantalla ancha los enlaces caben al lado del logo. En celular
              y tablet se bajan a su propia fila: con seis secciones, apretarlas
              aqui dejaba la mitad fuera de la pantalla, sin que se notara. */}
          <nav className="hidden flex-1 gap-1 lg:flex">{visibles.map(enlace)}</nav>

          <div className="ml-auto min-w-0 text-right lg:ml-0">
            <p className="truncate text-sm font-semibold leading-tight">{nombre}</p>
            <p className="truncate text-[11px] leading-tight text-suave">{rol}</p>
          </div>

          <button
            disabled={pendiente}
            onClick={() => iniciar(() => void salir())}
            className="shrink-0 rounded-lg border border-borde px-3 py-2 text-xs text-suave hover:border-alerta hover:text-alerta"
          >
            Salir
          </button>
        </div>

        {visibles.length > 1 && (
          <nav className="mt-2 flex flex-wrap gap-1 lg:hidden">
            {visibles.map(enlace)}
          </nav>
        )}
      </div>
    </header>
  );
}
