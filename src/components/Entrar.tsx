'use client';

import { useRef, useState, useTransition } from 'react';
import { entrar } from '@/lib/acciones';

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'borrar', '0', 'ok'];

export function Entrar() {
  const [codigo, setCodigo] = useState('');
  // El estado va un render por detras: quien teclea rapido en una tablet
  // perderia digitos. La referencia siempre tiene el codigo real.
  const marcado = useRef('');
  const [error, setError] = useState('');
  const [pendiente, iniciar] = useTransition();

  const enviar = (valor: string) => {
    setError('');
    iniciar(async () => {
      const fd = new FormData();
      fd.set('codigo', valor);
      const r = await entrar(fd);
      // Si el codigo sirve, la accion redirige y esto no llega a ejecutarse.
      if (!r.ok) {
        setError(r.error ?? 'No se pudo entrar');
        marcado.current = '';
        setCodigo('');
      }
    });
  };

  const tocar = (t: string) => {
    if (pendiente) return;

    if (t === 'ok') {
      if (marcado.current.length === 4) enviar(marcado.current);
      return;
    }

    const nuevo =
      t === 'borrar'
        ? marcado.current.slice(0, -1)
        : (marcado.current + t).slice(0, 4);

    marcado.current = nuevo;
    setCodigo(nuevo);
    // Con 4 digitos no hace falta confirmar: entra solo.
    if (nuevo.length === 4) enviar(nuevo);
  };

  return (
    <div className="tarjeta space-y-5 p-6">
      <p className="text-center text-sm text-suave">Marca tu codigo de acceso</p>

      <div className="flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border-2 transition ${
              codigo.length > i
                ? 'border-marca bg-marca'
                : 'border-borde bg-transparent'
            }`}
          />
        ))}
      </div>

      {error && <p className="text-center text-sm text-alerta">{error}</p>}

      <div className="grid grid-cols-3 gap-2">
        {TECLAS.map((t) => (
          <button
            key={t}
            disabled={pendiente}
            onClick={() => tocar(t)}
            className={`h-16 rounded-xl text-xl font-bold transition active:scale-95 disabled:opacity-40 ${
              t === 'ok'
                ? 'bg-marca text-black'
                : t === 'borrar'
                  ? 'border border-borde bg-panel2 text-suave'
                  : 'border border-borde bg-panel2'
            }`}
          >
            {t === 'borrar' ? '←' : t === 'ok' ? '✓' : t}
          </button>
        ))}
      </div>
    </div>
  );
}
