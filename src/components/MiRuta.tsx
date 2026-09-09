'use client';

import { useState, useTransition } from 'react';
import { cambiarEstadoPedido, cobrarEnRuta } from '@/lib/acciones';
import { dinero, nombreMetodo, transcurrido } from '@/lib/formato';
import { EstadoChip } from './EstadoChip';
import type { MetodoPago, PedidoCompleto } from '@/lib/tipos';
import type { CobroMetodo } from '@/lib/consultas';

/** Lo que un domiciliario puede recibir en la calle. */
const METODOS: [MetodoPago, string][] = [
  ['efectivo', 'Efectivo'],
  ['nequi', 'Nequi'],
  ['bre_b', 'Bre-B'],
  ['transferencia', 'Transferencia'],
];

interface Props {
  pedidos: PedidoCompleto[];
  porCobrar: number;
  efectivoHoy: number;
  cobradoHoy: number;
  entregasHoy: number;
  porMetodo: CobroMetodo[];
  hayCaja: boolean;
}

export function MiRuta({
  pedidos,
  porCobrar,
  efectivoHoy,
  cobradoHoy,
  entregasHoy,
  porMetodo,
  hayCaja,
}: Props) {
  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div className="tarjeta p-5">
        <p className="text-xs text-suave">Cobrado hoy</p>
        <p className="mt-1 text-3xl font-bold text-marca">{dinero(cobradoHoy)}</p>
        <p className="text-xs text-suave">
          {entregasHoy} entrega{entregasHoy === 1 ? '' : 's'}
        </p>

        {porMetodo.length > 0 && (
          <dl className="mt-4 space-y-1 border-t border-borde pt-3 text-sm">
            {porMetodo.map((m) => (
              <div key={m.metodo} className="flex justify-between">
                <dt className="text-suave">
                  {nombreMetodo(m.metodo)}{' '}
                  <span className="text-xs text-suave/70">({m.n})</span>
                </dt>
                <dd className="font-semibold">{dinero(m.monto)}</dd>
              </div>
            ))}
          </dl>
        )}

        <dl className="mt-3 space-y-1 border-t border-borde pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-suave">Efectivo que debes entregar</dt>
            <dd className="text-base font-bold text-ok">{dinero(efectivoHoy)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-suave">Te falta cobrar</dt>
            <dd className="text-base font-bold text-marca">{dinero(porCobrar)}</dd>
          </div>
        </dl>
      </div>

      {!hayCaja && (
        <p className="rounded-lg border border-marca/40 bg-marca/10 px-3 py-2 text-sm text-marca">
          La caja del negocio esta cerrada: no vas a poder registrar cobros hasta
          que la abran.
        </p>
      )}

      {pedidos.length === 0 ? (
        <div className="tarjeta p-10 text-center text-sm text-suave">
          No tienes pedidos asignados.
        </div>
      ) : (
        <ul className="space-y-3">
          {pedidos.map((p) => (
            <Tarjeta key={p.id} pedido={p} />
          ))}
        </ul>
      )}

    </div>
  );
}

function Tarjeta({ pedido }: { pedido: PedidoCompleto }) {
  const [cobrando, setCobrando] = useState(false);
  const [error, setError] = useState('');
  const [pendiente, iniciar] = useTransition();

  const cobrar = (metodo: MetodoPago) => {
    setError('');
    iniciar(async () => {
      const r = await cobrarEnRuta(pedido.id, metodo);
      if (!r.ok) setError(r.error ?? 'No se pudo registrar');
      else setCobrando(false);
    });
  };

  return (
    <li className="tarjeta overflow-hidden">
      <header className="flex items-start justify-between gap-2 border-b border-borde p-4">
        <div className="min-w-0">
          <h2 className="truncate font-bold">{pedido.cliente_nombre}</h2>
          <p className="text-xs text-suave">
            #{pedido.id} · {transcurrido(pedido.creado_en)}
          </p>
        </div>
        <EstadoChip estado={pedido.estado} />
      </header>

      <div className="space-y-3 p-4">
        <p className="text-sm">{pedido.cliente_direccion}</p>
        {pedido.cliente_notas && (
          <p className="text-sm text-marca">{pedido.cliente_notas}</p>
        )}

        {pedido.cliente_telefono && (
          <a
            href={`tel:${pedido.cliente_telefono.replace(/\s/g, '')}`}
            className="btn-neutro w-full py-2 text-sm"
          >
            Llamar {pedido.cliente_telefono}
          </a>
        )}

        <ul className="space-y-0.5 border-t border-borde pt-3 text-sm text-suave">
          {pedido.items.map((i) => (
            <li key={i.id}>
              {i.cantidad}× {i.nombre}
              {i.notas && <span className="text-marca"> ({i.notas})</span>}
            </li>
          ))}
        </ul>

        <div className="flex items-baseline justify-between border-t border-borde pt-3">
          <span className="text-sm text-suave">
            A cobrar
            {pedido.cuenta.domicilio > 0 &&
              ` (incluye ${dinero(pedido.cuenta.domicilio)} de domicilio)`}
          </span>
          <span className="text-2xl font-bold text-marca">
            {dinero(pedido.cuenta.saldo)}
          </span>
        </div>

        {error && <p className="text-sm text-alerta">{error}</p>}

        {!cobrando ? (
          <div className="grid grid-cols-2 gap-2">
            {pedido.estado !== 'en_camino' && (
              <button
                disabled={pendiente}
                onClick={() =>
                  iniciar(() => void cambiarEstadoPedido(pedido.id, 'en_camino'))
                }
                className="btn-neutro"
              >
                Voy en camino
              </button>
            )}
            <button
              onClick={() => setCobrando(true)}
              className={`btn-ok ${pedido.estado === 'en_camino' ? 'col-span-2' : ''}`}
            >
              Cobrar
            </button>
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
                  className="btn-marca py-4"
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
    </li>
  );
}
