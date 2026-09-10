'use client';

import { useEffect, useState, useTransition } from 'react';
import { cambiarEstadoPedido, cobrarEnRuta } from '@/lib/acciones';
import { dinero, nombreMetodo } from '@/lib/formato';
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
 *
 * La cuenta se puede pagar por partes: una en efectivo y el resto por Nequi,
 * o con un abono hecho antes de salir. Por eso lo que manda es el saldo y no
 * el total, y lo ya abonado se muestra siempre: es lo que evita que en la
 * puerta le cobren al cliente algo que ya pago.
 */
export function AccionesEntrega({ pedido }: { pedido: PedidoCompleto }) {
  const { cuenta } = pedido;
  const [cobrando, setCobrando] = useState(false);
  const [parcial, setParcial] = useState(false);
  const [monto, setMonto] = useState(String(cuenta.saldo));
  const [error, setError] = useState('');
  const [pendiente, iniciar] = useTransition();

  // Tras registrar un abono el saldo baja: el monto sugerido lo sigue.
  useEffect(() => {
    setMonto(String(cuenta.saldo));
    setParcial(false);
  }, [cuenta.saldo]);

  const yaPagado = cuenta.saldo <= 0;
  const enCamino = pedido.estado === 'en_camino';
  const nMonto = Number(monto) || 0;
  const sirve = nMonto > 0 && nMonto <= cuenta.saldo;

  const cobrar = (metodo: MetodoPago) => {
    setError('');
    iniciar(async () => {
      const r = await cobrarEnRuta(pedido.id, metodo, nMonto);
      if (!r.ok) setError(r.error ?? 'No se pudo registrar');
      else if (r.cerrado) setCobrando(false);
      // Si quedo saldo, la pantalla se queda abierta para el segundo medio.
    });
  };

  return (
    <div className="space-y-3">
      {/* ------------------------------------------------ lo que ya se pago */}
      {cuenta.pagado > 0 && (
        <ul className="space-y-1 border-t border-borde pt-3 text-sm">
          {pedido.pagos.map((p) => (
            <li key={p.id} className="flex justify-between gap-2 text-ok">
              <span>Ya pago por {nombreMetodo(p.metodo)}</span>
              <span className="font-semibold">{dinero(p.monto)}</span>
            </li>
          ))}
        </ul>
      )}

      {yaPagado ? (
        <div
          className={`flex flex-wrap items-baseline justify-between gap-2 ${
            cuenta.pagado > 0 ? '' : 'border-t border-borde pt-3'
          }`}
        >
          <span className="text-sm text-suave">Ya esta pagado</span>
          <span className="chip bg-ok/15 text-ok">No cobrar nada</span>
        </div>
      ) : (
        <div
          className={`flex flex-wrap items-baseline justify-between gap-2 ${
            cuenta.pagado > 0 ? '' : 'border-t border-borde pt-3'
          }`}
        >
          <span className="text-sm text-suave">
            {/* Lo del domicilio solo se aclara si no se ha abonado nada: con
                la cuenta a medias ya no se sabe que parte quedo cubierta. */}
            {cuenta.pagado > 0
              ? 'Cobrale solo'
              : `A cobrar${
                  cuenta.domicilio > 0
                    ? ` (incluye ${dinero(cuenta.domicilio)} de domicilio)`
                    : ''
                }`}
          </span>
          <span className="text-2xl font-bold text-marca">
            {dinero(cuenta.saldo)}
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
        <div className="space-y-3">
          {/* ------------------------------------------- cuanto de esta vez */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setParcial(false);
                setMonto(String(cuenta.saldo));
              }}
              className={`btn ${parcial ? 'btn-neutro' : 'btn-marca'} py-3 text-xs`}
            >
              Todo · {dinero(cuenta.saldo)}
            </button>
            <button
              onClick={() => setParcial(true)}
              className={`btn ${parcial ? 'btn-marca' : 'btn-neutro'} py-3 text-xs`}
            >
              Solo una parte
            </button>
          </div>

          {parcial && (
            <div>
              <label className="etiqueta" htmlFor={`monto-${pedido.id}`}>
                Cuanto te dan por este medio
              </label>
              <input
                id={`monto-${pedido.id}`}
                type="number"
                inputMode="numeric"
                className="campo text-2xl font-bold"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
              <p className="mt-1 text-xs text-suave">
                {nMonto > cuenta.saldo
                  ? `Es mas de lo que debe: solo faltan ${dinero(cuenta.saldo)}`
                  : `Quedarian ${dinero(cuenta.saldo - nMonto)} para el otro medio`}
              </p>
            </div>
          )}

          <div>
            <p className="etiqueta">
              ¿Por donde te pagaron {parcial ? dinero(nMonto) : 'todo'}?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {METODOS.map(([v, t]) => (
                <button
                  key={v}
                  disabled={pendiente || !sirve}
                  onClick={() => cobrar(v)}
                  className="btn-marca py-5"
                >
                  {t}
                </button>
              ))}
            </div>
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
