import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { comprobantesDe, obtenerPedido } from '@/lib/consultas';
import { exigir } from '@/lib/sesion';
import { dinero, etiquetaOrden, hora, nombreMetodo, transcurrido } from '@/lib/formato';
import { EstadoChip } from '@/components/EstadoChip';
import { AccionesEntrega } from '@/components/AccionesEntrega';
import { Comprobantes } from '@/components/Comprobantes';

export const dynamic = 'force-dynamic';

/** La orden completa, para revisarla contra la bolsa antes de entregar. */
export default async function DetalleEntrega({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await exigir('mi-ruta');
  const { id } = await params;
  const pedido = await obtenerPedido(Number(id));
  if (!pedido) notFound();

  // Cada quien ve solo lo suyo, aunque escriba la direccion a mano.
  if (pedido.domiciliario_id !== usuario.domiciliario_id) redirect('/mi-ruta');

  const cerrado = pedido.estado === 'pagado' || pedido.estado === 'anulado';

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <Link href="/mi-ruta" className="inline-block text-sm text-suave hover:text-texto">
        ← Mi ruta
      </Link>

      <section className="tarjeta overflow-hidden">
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-borde p-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">{pedido.cliente_nombre}</h1>
            <p className="text-xs text-suave">
              {etiquetaOrden(pedido.numero, pedido.creado_en, pedido.id)}
              <br />
              {transcurrido(pedido.creado_en)}
            </p>
          </div>
          <EstadoChip estado={pedido.estado} />
        </header>

        <div className="space-y-4 p-4">
          <div>
            <p className="etiqueta">Direccion</p>
            <p className="text-base">{pedido.cliente_direccion}</p>
            {pedido.cliente_notas && (
              <p className="mt-1 text-sm text-marca">{pedido.cliente_notas}</p>
            )}
          </div>

          {pedido.cliente_telefono && (
            <a
              href={`tel:${pedido.cliente_telefono.replace(/\s/g, '')}`}
              className="btn-neutro w-full py-3"
            >
              Llamar {pedido.cliente_telefono}
            </a>
          )}
        </div>
      </section>

      {/* El detalle que sirve para comparar contra lo que lleva en la bolsa. */}
      <section className="tarjeta overflow-hidden">
        <h2 className="border-b border-borde px-4 py-3 font-semibold">
          La orden ({pedido.items.reduce((s, i) => s + i.cantidad, 0)} items)
        </h2>
        <ul className="divide-y divide-borde">
          {pedido.items.map((i) => (
            <li key={i.id} className="flex gap-3 px-4 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-panel2 font-bold text-marca">
                {i.cantidad}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{i.nombre}</p>
                {i.notas && <p className="text-sm text-marca">{i.notas}</p>}
              </div>
              <span className="whitespace-nowrap text-sm text-suave">
                {dinero(i.precio_unit * i.cantidad)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="space-y-1 border-t border-borde p-4 text-sm">
          <Fila k="Productos" v={dinero(pedido.cuenta.subtotal)} />
          {pedido.cuenta.descuento > 0 && (
            <Fila k="Descuento" v={`- ${dinero(pedido.cuenta.descuento)}`} />
          )}
          {pedido.cuenta.domicilio > 0 && (
            <Fila k="Domicilio" v={dinero(pedido.cuenta.domicilio)} />
          )}
          <div className="flex justify-between border-t border-borde pt-2 text-lg font-bold">
            <dt>Total</dt>
            <dd className="text-marca">{dinero(pedido.cuenta.total)}</dd>
          </div>
        </dl>
      </section>

      {pedido.pagos.length > 0 && (
        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-borde px-4 py-3 text-sm font-semibold">
            Pagos registrados
          </h2>
          <ul className="divide-y divide-borde text-sm">
            {pedido.pagos.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1">{nombreMetodo(g.metodo)}</span>
                <span className="text-xs text-suave">{hora(g.creado_en)}</span>
                <span className="font-semibold">{dinero(g.monto)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="tarjeta p-4">
        <Comprobantes
          pedidoId={pedido.id}
          comprobantes={await comprobantesDe(pedido.id)}
        />
      </section>

      {!cerrado && (
        <section className="tarjeta p-4">
          <AccionesEntrega pedido={pedido} />
        </section>
      )}
    </div>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-suave">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
