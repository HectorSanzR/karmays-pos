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
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {usuario.nombre}
          {esYo && <span className="ml-2 text-xs text-suave">(tu)</span>}
        </p>
        <p className="text-xs text-suave">
          {etiquetaRol}
          {usuario.telefono ? ` · ${usuario.telefono}` : ''}
        </p>
      </div>

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
        className={`w-28 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
          activo
            ? 'bg-ok/15 text-ok hover:bg-ok/25'
            : 'border border-borde bg-panel2 text-suave'
        }`}
      >
        {activo ? 'Con acceso' : 'Sin acceso'}
      </button>
    </li>
  );
}
