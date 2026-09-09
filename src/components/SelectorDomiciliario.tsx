'use client';

import { useTransition } from 'react';
import { asignarDomiciliario, despachar } from '@/lib/acciones';
import type { Domiciliario } from '@/lib/tipos';

interface Props {
  pedidoId: number;
  asignadoA: number | null;
  estado: string;
  domiciliarios: Domiciliario[];
  /** Muestra el boton de despachar (solo tiene sentido en la lista). */
  conDespacho?: boolean;
}

export function SelectorDomiciliario({
  pedidoId,
  asignadoA,
  estado,
  domiciliarios,
  conDespacho = false,
}: Props) {
  const [pendiente, iniciar] = useTransition();

  const enRuta = estado === 'en_camino' || estado === 'entregado';

  if (domiciliarios.length === 0) {
    return (
      <span className="text-xs text-suave">
        Sin domiciliarios registrados
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Domiciliario asignado"
        disabled={pendiente}
        value={asignadoA ?? ''}
        onChange={(e) =>
          iniciar(() =>
            void asignarDomiciliario(pedidoId, Number(e.target.value) || null),
          )
        }
        className={`campo py-1.5 text-sm ${
          asignadoA ? 'border-info/50 text-texto' : 'text-suave'
        }`}
      >
        <option value="">Sin asignar</option>
        {domiciliarios.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nombre}
          </option>
        ))}
      </select>

      {conDespacho && asignadoA && !enRuta && (
        <button
          disabled={pendiente}
          onClick={() => iniciar(() => void despachar(pedidoId, asignadoA))}
          className="btn-marca shrink-0 px-3 py-1.5 text-xs"
        >
          Despachar
        </button>
      )}
    </div>
  );
}
