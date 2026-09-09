'use client';

import { useState, useTransition } from 'react';
import { cambiarEstadoPedido, cobrarEnRuta } from '@/lib/acciones';
import { dinero } from '@/lib/formato';
import type { MetodoPago, PedidoCompleto } from '@/lib/tipos';

/** Lo que un domiciliario puede recibir en la calle. */
const METODOS: [MetodoPago, string][] = [
  ['efectivo', 'Efectivo'],
  ['nequi', 'Nequi'],
  ['bre_b', 'Bre-B'],
  ['transferencia', 'Transferencia'],
];

/**
 * El cuanto y los botones de una entrega. Se usa igual en la lista de la ruta
 * y en el detalle del pedido, para que no haya dos formas de cobrar.
 */
export function AccionesEntrega({ pedido }: { pedido: PedidoCompleto }) {
  const [cobrando, setCobrando] = useState(false);
  const [error, setError] = useState('');
  const [pendiente, iniciar] = useTransition();

  const yaPagado = pedido.cuenta.saldo <= 0;
  const enCamino = pedido.estado === 'en_camino';

  const cobrar = (metodo: MetodoPago) => {
    setError('');
    iniciar(async () => {
      const r = await cobrarEnRuta(pedido.id, metodo);
      if (!r.ok) setError(r.error ?? 'No se pudo registrar');
      else setCobrando(false);
    });
  };

  return (
    <div className="space-y-3">
      {yaPagado ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-borde pt-3">
          <span className="text-sm text-suave">Ya esta pagado</span>
          <span className="chip bg-ok/15 text-ok">No cobrar nada</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-borde pt-3">
          <span className="text-sm text-suave">
            A cobrar
            {pedido.cuenta.domicilio > 0 &&
              ` (incluye ${dinero(pedido.cuenta.domicilio)} de domicilio)`}
          </span>
          <span className="text-2xl font-bold text-marca">
            {dinero(pedido.cuenta.saldo)}
          </span>
        </div>
      )}

      {error && <p className="text-sm text-alerta">{error}</p>}

      {!cobrando ? (
        <div className="grid grid-cols-2 gap-2">
          {!enCamino && (
            <button
              disabled={pendiente}
              onClick={() =>
                iniciar(() => void cambiarEstadoPedido(pedido.id, 'en_camino'))
              }
              className="btn-neutro py-4"
            >
              Voy en camino
            </button>
          )}
          {yaPagado ? (
            <button
              disabled={pendiente}
              onClick={() =>
                iniciar(() => void cambiarEstadoPedido(pedido.id, 'entregado'))
              }
              className={`btn-ok py-4 ${enCamino ? 'col-span-2' : ''}`}
            >
              Entregado
            </button>
          ) : (
            <button
              onClick={() => setCobrando(true)}
              className={`btn-ok py-4 ${enCamino ? 'col-span-2' : ''}`}
            >
              Cobrar
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="etiqueta">¿Por donde te pagaron?</p>
          <div className="grid grid-cols-2 gap-2">
            {METODOS.map(([v, t]) => (
              <button
                key={v}
                disabled={pendiente}
                onClick={() => cobrar(v)}
                className="btn-marca py-5"
              >
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCobrando(false)}
            className="btn-neutro w-full py-2 text-xs"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
