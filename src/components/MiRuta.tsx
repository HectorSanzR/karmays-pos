'use client';

import Link from 'next/link';
import { AccionesEntrega } from './AccionesEntrega';
import { EstadoChip } from './EstadoChip';
import { dinero, hora, nombreMetodo, transcurrido } from '@/lib/formato';
import type { PedidoCompleto } from '@/lib/tipos';
import type { CobroMetodo, EntregaDelTurno } from '@/lib/consultas';

interface Props {
  pedidos: PedidoCompleto[];
  porCobrar: number;
  efectivoTurno: number;
  cobradoTurno: number;
  entregasTurno: number;
  porMetodo: CobroMetodo[];
  entregas: EntregaDelTurno[];
  hayCaja: boolean;
}

export function MiRuta({
  pedidos,
  porCobrar,
  efectivoTurno,
  cobradoTurno,
  entregasTurno,
  porMetodo,
  entregas,
  hayCaja,
}: Props) {
  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div className="tarjeta p-5">
        <p className="text-xs text-suave">Cobrado en el turno</p>
        <p className="mt-1 text-3xl font-bold text-marca">{dinero(cobradoTurno)}</p>
        <p className="text-xs text-suave">
          {entregasTurno} entrega{entregasTurno === 1 ? '' : 's'}
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
            <dd className="text-base font-bold text-ok">{dinero(efectivoTurno)}</dd>
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

      {entregas.length > 0 && (
        <div className="tarjeta overflow-hidden">
          <h2 className="border-b border-borde px-4 py-3 text-sm font-semibold">
            Lo que ya entregaste ({entregas.length})
          </h2>
          <ul className="divide-y divide-borde">
            {entregas.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/mi-ruta/${e.id}`}
                  className="block px-4 py-2.5 text-sm transition hover:bg-panel2"
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {e.cliente_nombre ?? `Pedido #${e.id}`}
                    </span>
                    <span className="whitespace-nowrap font-semibold">
                      {dinero(e.total)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-suave">{e.cliente_direccion}</p>
                  <p className="text-xs text-suave">
                    {hora(e.cerrado_en)} ·{' '}
                    {(e.metodos ?? '')
                      .split(',')
                      .filter(Boolean)
                      .map(nombreMetodo)
                      .join(' + ')}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


/** Cada pedido de la ruta, con lo justo para salir y un enlace a la orden. */
function Tarjeta({ pedido }: { pedido: PedidoCompleto }) {
  return (
    <li className="tarjeta overflow-hidden">
      <Link href={`/mi-ruta/${pedido.id}`} className="group block">
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-borde p-4">
          <div className="min-w-0">
            <h2 className="truncate font-bold group-hover:text-marca">
              {pedido.cliente_nombre}
            </h2>
            <p className="text-xs text-suave">
              #{pedido.id} · {transcurrido(pedido.creado_en)}
            </p>
          </div>
          <EstadoChip estado={pedido.estado} />
        </header>

        <div className="space-y-2 p-4 pb-0">
          <p className="text-sm">{pedido.cliente_direccion}</p>
          {pedido.cliente_notas && (
            <p className="text-sm text-marca">{pedido.cliente_notas}</p>
          )}

          <ul className="border-t border-borde pt-3 text-sm text-suave">
            {pedido.items.map((i) => (
              <li key={i.id} className="truncate">
                {i.cantidad}× {i.nombre}
                {i.notas && <span className="text-marca"> ({i.notas})</span>}
              </li>
            ))}
          </ul>

          <p className="pt-1 text-xs font-semibold text-marca group-hover:underline">
            Ver la orden completa →
          </p>
        </div>
      </Link>

      <div className="space-y-3 p-4">
        {pedido.cliente_telefono && (
          <a
            href={`tel:${pedido.cliente_telefono.replace(/\s/g, '')}`}
            className="btn-neutro w-full py-3"
          >
            Llamar {pedido.cliente_telefono}
          </a>
        )}

        <AccionesEntrega pedido={pedido} />
      </div>
    </li>
  );
}
