'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { anularPago, fijarPropina, registrarPago } from '@/lib/acciones';
import { dinero, etiquetaOrden } from '@/lib/formato';
import { Comprobantes } from './Comprobantes';
import type { MetodoPago, PedidoCompleto } from '@/lib/tipos';
import type { Comprobante } from '@/lib/consultas';

const METODOS: [MetodoPago, string][] = [
  ['efectivo', 'Efectivo'],
  ['nequi', 'Nequi'],
  ['daviplata', 'Daviplata'],
  ['bre_b', 'Bre-B'],
  ['tarjeta', 'Tarjeta'],
  ['transferencia', 'Otra transf.'],
];

const BILLETES = [5000, 10000, 20000, 50000, 100000];

export function Recaudo({
  pedido,
  comprobantes,
}: {
  pedido: PedidoCompleto;
  comprobantes: Comprobante[];
}) {
  const { cuenta } = pedido;
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [monto, setMonto] = useState<string>(String(cuenta.saldo));
  const [recibido, setRecibido] = useState<string>('');
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState('');
  const [pendiente, iniciar] = useTransition();

  // Si el saldo cambia (propina, pago parcial), reajusta el monto sugerido.
  useEffect(() => {
    setMonto(String(cuenta.saldo));
    setRecibido('');
  }, [cuenta.saldo]);

  const nMonto = Number(monto) || 0;
  const nRecibido = Number(recibido) || 0;
  const cambio = metodo === 'efectivo' && nRecibido > 0 ? nRecibido - nMonto : 0;

  // Manda el saldo, no el estado: un domicilio pagado por adelantado sigue su
  // curso (en cocina, en camino) y no se marca 'pagado' hasta que se entrega,
  // pero cobrar ya no hay nada que cobrarle.
  if (cuenta.pagado > 0 && cuenta.saldo <= 0) {
    const ultimo = pedido.pagos.at(-1);
    const enCurso = pedido.estado !== 'pagado' && pedido.estado !== 'anulado';

    return (
      <div className="tarjeta space-y-4 p-8 text-center">
        <p className="text-5xl">✓</p>
        <h1 className="text-2xl font-bold text-ok">Pedido cobrado</h1>
        <p className="text-suave">
          {pedido.mesa_nombre ?? pedido.cliente_nombre ?? `Pedido #${pedido.id}`} ·{' '}
          {dinero(cuenta.total)}
        </p>
        {!!ultimo?.cambio && (
          <p className="text-xl font-bold text-marca">
            Cambio: {dinero(ultimo.cambio)}
          </p>
        )}
        {enCurso && (
          <p className="rounded-lg border border-info/40 bg-info/10 px-3 py-2 text-sm text-info">
            Queda pagado, pero todavia no se ha entregado. Sigue en la lista de
            domicilios para asignarle domiciliario y despacharlo.
          </p>
        )}
        <div className="mx-auto max-w-xs text-left">
          <Comprobantes pedidoId={pedido.id} comprobantes={comprobantes} />
        </div>

        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link
            href={`/pedido/${pedido.id}/recibo?imprimir=1`}
            target="_blank"
            className="btn-marca"
          >
            Imprimir recibo
          </Link>
          <Link href={`/pedido/${pedido.id}/recibo`} className="btn-neutro">
            Ver recibo
          </Link>
          {enCurso ? (
            <Link href="/domicilios" className="btn-marca">
              Volver a domicilios
            </Link>
          ) : (
            <Link href="/" className="btn-marca">
              Listo
            </Link>
          )}
        </div>
      </div>
    );
  }

  const cobrar = () => {
    setError('');
    iniciar(async () => {
      const r = await registrarPago(
        pedido.id,
        metodo,
        nMonto,
        metodo === 'efectivo' && nRecibido > 0 ? nRecibido : undefined,
        referencia,
      );
      if (!r.ok) setError(r.error ?? 'No se pudo registrar el pago');
      else setReferencia('');
    });
  };

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------ cuenta */}
      <section className="tarjeta p-5">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-bold">
            {pedido.mesa_nombre ?? pedido.cliente_nombre ?? `Pedido #${pedido.id}`}
          </h1>
          <span className="text-xs text-suave">
            {etiquetaOrden(pedido.numero, pedido.creado_en, pedido.id)}
          </span>
        </div>

        <ul className="mt-4 space-y-1 text-sm">
          {pedido.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span className="text-suave">
                {i.cantidad}× {i.nombre}
              </span>
              <span>{dinero(i.precio_unit * i.cantidad)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-1 border-t border-borde pt-3 text-sm">
          <Fila k="Subtotal" v={dinero(cuenta.subtotal)} />
          {cuenta.descuento > 0 && (
            <Fila k="Descuento" v={`- ${dinero(cuenta.descuento)}`} />
          )}
          {cuenta.domicilio > 0 && <Fila k="Domicilio" v={dinero(cuenta.domicilio)} />}
          <Fila k="Propina" v={dinero(cuenta.propina)} />
          <div className="flex justify-between pt-2 text-2xl font-bold">
            <span>Total</span>
            <span className="text-marca">{dinero(cuenta.total)}</span>
          </div>
          {cuenta.pagado > 0 && (
            <div className="flex justify-between pt-1 text-lg font-semibold text-ok">
              <span>Saldo</span>
              <span>{dinero(cuenta.saldo)}</span>
            </div>
          )}
        </div>
      </section>

      {/* ----------------------------------------------------------- propina */}
      <section className="tarjeta p-5">
        <p className="etiqueta">Propina voluntaria</p>
        <div className="flex flex-wrap gap-2">
          {[0, 0.05, 0.1].map((pct) => {
            const valor = Math.round((cuenta.subtotal - cuenta.descuento) * pct);
            return (
              <button
                key={pct}
                disabled={pendiente}
                onClick={() => iniciar(() => void fijarPropina(pedido.id, valor))}
                className={`btn ${
                  cuenta.propina === valor ? 'btn-marca' : 'btn-neutro'
                } py-2`}
              >
                {pct === 0 ? 'Sin propina' : `${pct * 100}% · ${dinero(valor)}`}
              </button>
            );
          })}
        </div>
      </section>

      {/* -------------------------------------------------------------- pago */}
      <section className="tarjeta space-y-4 p-5">
        <div>
          <p className="etiqueta">Metodo de pago</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {METODOS.map(([v, t]) => (
              <button
                key={v}
                onClick={() => setMetodo(v)}
                className={`btn ${metodo === v ? 'btn-marca' : 'btn-neutro'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="etiqueta" htmlFor="monto">
            Monto a cobrar
          </label>
          <input
            id="monto"
            type="number"
            inputMode="numeric"
            className="campo text-2xl font-bold"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          {cuenta.saldo > 0 && nMonto !== cuenta.saldo && (
            <button
              onClick={() => setMonto(String(cuenta.saldo))}
              className="mt-2 text-xs text-marca"
            >
              Cobrar el saldo completo ({dinero(cuenta.saldo)})
            </button>
          )}
        </div>

        {metodo === 'efectivo' && (
          <div>
            <label className="etiqueta" htmlFor="recibido">
              Con cuanto paga
            </label>
            <input
              id="recibido"
              type="number"
              inputMode="numeric"
              className="campo text-xl"
              value={recibido}
              onChange={(e) => setRecibido(e.target.value)}
              placeholder="Opcional"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => setRecibido(String(nMonto))}
                className="btn-neutro px-3 py-1.5 text-xs"
              >
                Exacto
              </button>
              {BILLETES.filter((b) => b >= nMonto).map((b) => (
                <button
                  key={b}
                  onClick={() => setRecibido(String(b))}
                  className="btn-neutro px-3 py-1.5 text-xs"
                >
                  {dinero(b)}
                </button>
              ))}
            </div>
            {nRecibido > 0 && (
              <p
                className={`mt-3 text-xl font-bold ${
                  cambio < 0 ? 'text-alerta' : 'text-ok'
                }`}
              >
                {cambio < 0
                  ? `Faltan ${dinero(-cambio)}`
                  : `Cambio: ${dinero(cambio)}`}
              </p>
            )}
          </div>
        )}

        {metodo !== 'efectivo' && (
          <div>
            <label className="etiqueta" htmlFor="referencia">
              Referencia / voucher
            </label>
            <input
              id="referencia"
              className="campo"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        )}

        {/* Siempre a la vista, no solo con pago digital: escondiendolo al
            elegir efectivo, los comprobantes ya adjuntos desaparecian de la
            pantalla y parecia que se hubieran perdido. */}
        <div className="border-t border-borde pt-4">
          <Comprobantes pedidoId={pedido.id} comprobantes={comprobantes} />
        </div>

        {error && (
          <p className="rounded-lg border border-alerta/40 bg-alerta/10 px-3 py-2 text-sm text-alerta">
            {error}
          </p>
        )}

        <button
          onClick={cobrar}
          disabled={pendiente || nMonto <= 0 || cambio < 0}
          className="btn-ok w-full py-4 text-base"
        >
          {pendiente ? 'Registrando...' : `Registrar ${dinero(nMonto)}`}
        </button>
      </section>

      {/* ------------------------------------------------------ pagos hechos */}
      {pedido.pagos.length > 0 && (
        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-borde px-4 py-3 text-sm font-semibold">
            Pagos registrados
          </h2>
          <ul className="divide-y divide-borde text-sm">
            {pedido.pagos.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 capitalize">{p.metodo}</span>
                <span className="font-semibold">{dinero(p.monto)}</span>
                <button
                  disabled={pendiente}
                  onClick={() => iniciar(() => void anularPago(p.id))}
                  className="text-xs text-alerta hover:underline"
                >
                  anular
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-suave">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
