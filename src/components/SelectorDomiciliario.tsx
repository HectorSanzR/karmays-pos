'use client';

import { useState, useTransition } from 'react';
import { asignarDomiciliario, despachar } from '@/lib/acciones';

export interface OpcionDomiciliario {
  id: number;
  nombre: string;
  /** Pedidos que ya lleva sin liquidar, para no cargarle todo al mismo. */
  en_ruta?: number;
}

interface Props {
  pedidoId: number;
  asignadoA: number | null;
  /** Por si quien lo lleva ya no aparece entre los activos. */
  asignadoNombre?: string | null;
  estado: string;
  domiciliarios: OpcionDomiciliario[];
  /** Muestra el boton de despachar (solo tiene sentido en la lista). */
  conDespacho?: boolean;
}

/**
 * Los domiciliarios como recuadros y no como lista desplegable: en despacho
 * se reparte de afan y con la bolsa en la mano, asi que se toca el nombre
 * directo y el boton de despachar sale dentro del mismo recuadro.
 */
export function SelectorDomiciliario({
  pedidoId,
  asignadoA,
  asignadoNombre,
  estado,
  domiciliarios,
  conDespacho = false,
}: Props) {
  const [pendiente, iniciar] = useTransition();
  // Cual recuadro se acaba de tocar, para marcarlo mientras responde el server.
  const [tocado, setTocado] = useState<number | null>(null);
  const [abierto, setAbierto] = useState(false);

  const enRuta = estado === 'en_camino' || estado === 'entregado';

  if (domiciliarios.length === 0) {
    return <span className="text-xs text-suave">Sin domiciliarios registrados</span>;
  }

  // Ya salio: no se llena la pantalla con todos los nombres, solo con quien
  // lo lleva. Cambiarlo sigue siendo posible, pero hay que pedirlo.
  const lista =
    enRuta && !abierto
      ? domiciliarios.filter((d) => d.id === asignadoA)
      : domiciliarios;

  const perdido =
    asignadoA !== null && !domiciliarios.some((d) => d.id === asignadoA);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {perdido && (
          <span className="rounded-xl border border-info/50 bg-info/10 px-3 py-2 text-sm text-info">
            {asignadoNombre ?? 'Domiciliario inactivo'}
          </span>
        )}

        {lista.map((d) => {
          const suyo = d.id === asignadoA;
          const esperando = pendiente && tocado === d.id;

          return (
            <div
              key={d.id}
              className={`min-w-0 overflow-hidden rounded-xl border transition ${
                suyo
                  ? enRuta
                    ? 'border-info bg-info/10'
                    : 'border-marca bg-marca/10'
                  : 'border-borde bg-panel2 hover:border-marca/60'
              } ${esperando ? 'opacity-60' : ''}`}
            >
              <button
                type="button"
                disabled={pendiente}
                aria-pressed={suyo}
                onClick={() => {
                  setTocado(d.id);
                  iniciar(() => void asignarDomiciliario(pedidoId, suyo ? null : d.id));
                }}
                title={suyo ? 'Tocar otra vez para quitarlo' : `Asignar a ${d.nombre}`}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm disabled:cursor-wait"
              >
                <span
                  className={`truncate font-semibold ${
                    suyo ? (enRuta ? 'text-info' : 'text-marca') : ''
                  }`}
                >
                  {d.nombre}
                </span>
                <span
                  className={`shrink-0 text-xs ${d.en_ruta ? 'text-suave' : 'text-ok'}`}
                >
                  {d.en_ruta ? `${d.en_ruta} en ruta` : 'libre'}
                </span>
              </button>

              {suyo && conDespacho && !enRuta && (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => {
                    setTocado(d.id);
                    iniciar(() => void despachar(pedidoId, d.id));
                  }}
                  className="w-full bg-marca px-3 py-2 text-xs font-bold text-black transition hover:bg-marca2 disabled:cursor-wait"
                >
                  Despachar
                </button>
              )}

              {suyo && enRuta && (
                <p className="bg-info/15 px-3 py-1.5 text-center text-xs font-semibold text-info">
                  En la calle
                </p>
              )}
            </div>
          );
        })}
      </div>

      {enRuta && (
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="text-xs text-suave underline-offset-2 hover:text-marca hover:underline"
        >
          {abierto ? 'Dejar asi' : 'Cambiar de domiciliario'}
        </button>
      )}
    </div>
  );
}
