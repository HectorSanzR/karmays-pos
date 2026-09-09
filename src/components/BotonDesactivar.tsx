'use client';

import { useTransition } from 'react';
import { activarDomiciliario } from '@/lib/acciones';

export function BotonDesactivar({ id, nombre }: { id: number; nombre: string }) {
  const [pendiente, iniciar] = useTransition();

  return (
    <button
      disabled={pendiente}
      title="Sacar de la lista"
      onClick={() => {
        if (confirm(`¿Sacar a ${nombre} de la lista de domiciliarios?`))
          iniciar(() => void activarDomiciliario(id, false));
      }}
      className="shrink-0 rounded-lg border border-borde px-2 py-1 text-xs text-suave hover:border-alerta hover:text-alerta"
    >
      Quitar
    </button>
  );
}
