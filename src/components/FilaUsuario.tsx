'use client';

import { useState, useTransition } from 'react';
import { activarUsuario, regenerarCodigo } from '@/lib/acciones';
import type { Usuario } from '@/lib/tipos';

interface Props {
  usuario: Usuario;
  etiquetaRol: string;
  /** El admin no puede quitarse el acceso a si mismo y quedar afuera. */
  esYo: boolean;
}

export function FilaUsuario({ usuario, etiquetaRol, esYo }: Props) {
  const [verCodigo, setVerCodigo] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const activo = usuario.activo === 1;

  return (
    // En celular los tres controles no caben junto al nombre y lo dejaban
    // reducido a una letra: ahi se apilan debajo.
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0 sm:flex-1">
        <p className="truncate font-semibold">
          {usuario.nombre}
          {esYo && <span className="ml-2 text-xs text-suave">(tu)</span>}
        </p>
        <p className="text-xs text-suave">
          {etiquetaRol}
          {usuario.telefono ? ` · ${usuario.telefono}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:contents">
      <button
        onClick={() => setVerCodigo((v) => !v)}
        title={verCodigo ? 'Ocultar' : 'Ver codigo'}
        className="w-24 rounded-lg border border-borde bg-panel2 py-1.5 text-center font-mono text-base font-bold tracking-widest text-marca"
      >
        {verCodigo ? usuario.codigo : '••••'}
      </button>

      <button
        disabled={pendiente}
        onClick={() => {
          if (confirm(`¿Cambiar el codigo de ${usuario.nombre}? El actual deja de servir.`))
            iniciar(() => void regenerarCodigo(usuario.id));
        }}
        className="rounded-lg border border-borde px-2 py-1.5 text-xs text-suave hover:text-texto"
      >
        Cambiar
      </button>

      <button
        disabled={pendiente || esYo}
        onClick={() => iniciar(() => void activarUsuario(usuario.id, !activo))}
        className={`ml-auto w-28 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-40 sm:ml-0 sm:py-1.5 ${
          activo
            ? 'bg-ok/15 text-ok hover:bg-ok/25'
            : 'border border-borde bg-panel2 text-suave'
        }`}
      >
        {activo ? 'Con acceso' : 'Sin acceso'}
      </button>
      </div>
    </li>
  );
}
