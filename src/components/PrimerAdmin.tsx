'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { crearAdminInicial } from '@/lib/acciones';

/** Arranque del sistema: no hay nadie todavia, se crea al dueño. */
export function PrimerAdmin() {
  const [error, setError] = useState('');
  const [pendiente, iniciar] = useTransition();
  const router = useRouter();

  return (
    <div className="tarjeta space-y-4 p-6">
      <div>
        <h2 className="font-bold">Configura tu acceso</h2>
        <p className="mt-1 text-sm text-suave">
          Este es el usuario administrador: el unico que ve la caja, los codigos
          y las cifras del negocio. Elige un codigo de 4 numeros y no lo compartas.
        </p>
      </div>

      <form
        action={(fd) =>
          iniciar(async () => {
            const r = await crearAdminInicial(fd);
            if (!r.ok) setError(r.error ?? 'No se pudo crear');
            else router.refresh();
          })
        }
        className="space-y-3"
      >
        <div>
          <label className="etiqueta" htmlFor="nombre">
            Tu nombre
          </label>
          <input id="nombre" name="nombre" className="campo" required />
        </div>
        <div>
          <label className="etiqueta" htmlFor="codigo">
            Codigo de 4 numeros
          </label>
          <input
            id="codigo"
            name="codigo"
            className="campo text-center font-mono text-2xl tracking-[0.5em]"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            required
          />
        </div>

        {error && <p className="text-sm text-alerta">{error}</p>}

        <button type="submit" disabled={pendiente} className="btn-marca w-full py-3">
          Crear y entrar
        </button>
      </form>
    </div>
  );
}
