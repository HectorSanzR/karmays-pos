import Link from 'next/link';
import {
  cobrosPorMetodo,
  historialPedidos,
  listarTurnos,
  productosVendidos,
  type PedidoHistorial,
} from '@/lib/consultas';
import { exigir } from '@/lib/sesion';
import { dinero, fecha, hora, nombreMetodo } from '@/lib/formato';

export const dynamic = 'force-dynamic';

const NOMBRE_TIPO: Record<string, string> = {
  mesa: 'Mesa',
  domicilio: 'Domicilio',
  llevar: 'Para llevar',
};

export default async function Historial({
  searchParams,
}: {
  searchParams: Promise<{ turno?: string }>;
}) {
  await exigir('historial');

  const { turno } = await searchParams;
  const turnos = listarTurnos();

  // Sin parametro se muestra el turno mas reciente; "todos" abre el historial
  // completo.
  const sesionId =
    turno === 'todos' ? null : turno ? Number(turno) : (turnos[0]?.id ?? null);

  const pedidos = historialPedidos(sesionId);
  const metodos = cobrosPorMetodo(sesionId);
  const productos = productosVendidos(sesionId);

  const cobrados = pedidos.filter((p) => p.estado === 'pagado');
  const anulados = pedidos.filter((p) => p.estado === 'anulado');
  const vendido = metodos.reduce((s, m) => s + m.monto, 0);

  const porTipo = cobrados.reduce<Record<string, { n: number; monto: number }>>(
    (acc, p) => {
      const t = (acc[p.tipo] ??= { n: 0, monto: 0 });
      t.n += 1;
      t.monto += p.total;
      return acc;
    },
    {},
  );

  const elTurno = turnos.find((t) => t.id === sesionId);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Historial</h1>
        <form className="flex gap-2">
          <select
            name="turno"
            defaultValue={turno ?? String(sesionId ?? 'todos')}
            className="campo py-2 text-sm"
          >
            {turnos.map((t) => (
              <option key={t.id} value={t.id}>
                Turno del {fecha(t.abierta_en)}
                {t.cerrada_en ? '' : ' (abierto)'} — {dinero(t.ventas)}
              </option>
            ))}
            <option value="todos">Todo el historial</option>
          </select>
          <button type="submit" className="btn-neutro py-2">
            Ver
          </button>
        </form>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="tarjeta p-5">
          <p className="text-xs text-suave">
            {sesionId === null ? 'Vendido en total' : 'Vendido en el turno'}
          </p>
          <p className="mt-1 text-3xl font-bold text-marca">{dinero(vendido)}</p>
          <p className="text-xs text-suave">
            {cobrados.length} pedidos cobrados
            {anulados.length > 0 && ` · ${anulados.length} anulados`}
          </p>
          {elTurno && (
            <p className="mt-2 border-t border-borde pt-2 text-xs text-suave">
              Abierto {fecha(elTurno.abierta_en)}
              <br />
              {elTurno.cerrada_en
                ? `Cerrado ${fecha(elTurno.cerrada_en)}`
                : 'Sigue abierto'}
            </p>
          )}
        </div>

        <div className="tarjeta p-5">
          <p className="mb-2 text-xs text-suave">Por medio de pago</p>
          {metodos.length === 0 ? (
            <p className="text-sm text-suave">Sin cobros.</p>
          ) : (
            <dl className="space-y-1 text-sm">
              {metodos.map((m) => (
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
        </div>

        <div className="tarjeta p-5">
          <p className="mb-2 text-xs text-suave">Por donde salio</p>
          {Object.keys(porTipo).length === 0 ? (
            <p className="text-sm text-suave">Sin ventas.</p>
          ) : (
            <dl className="space-y-1 text-sm">
              {Object.entries(porTipo).map(([tipo, v]) => (
                <div key={tipo} className="flex justify-between">
                  <dt className="text-suave">
                    {NOMBRE_TIPO[tipo] ?? tipo}{' '}
                    <span className="text-xs text-suave/70">({v.n})</span>
                  </dt>
                  <dd className="font-semibold">{dinero(v.monto)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="tarjeta overflow-hidden">
          <h2 className="border-b border-borde px-4 py-3 font-semibold">
            Pedidos ({pedidos.length})
          </h2>
          {pedidos.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-suave">
              Todavia no se ha cerrado ningun pedido aqui.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-borde text-left text-xs uppercase text-suave">
                  <tr>
                    <th className="px-4 py-2 font-medium">Hora</th>
                    <th className="px-2 py-2 font-medium">#</th>
                    <th className="px-2 py-2 font-medium">Donde</th>
                    <th className="px-2 py-2 font-medium">Quien</th>
                    <th className="px-2 py-2 font-medium">Pago</th>
                    <th className="px-2 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {pedidos.map((p) => (
                    <Fila key={p.id} p={p} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pedidos.length >= 500 && (
            <p className="border-t border-borde px-4 py-2 text-xs text-suave">
              Se muestran los 500 mas recientes. Filtra por turno para ver el resto.
            </p>
          )}
        </section>

        <section className="tarjeta h-fit overflow-hidden">
          <h2 className="border-b border-borde px-4 py-3 font-semibold">
            Lo que mas se vendio
          </h2>
          {productos.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-suave">Nada aun.</p>
          ) : (
            <ul className="divide-y divide-borde text-sm">
              {productos.map((pr) => (
                <li key={pr.nombre} className="flex items-center gap-2 px-4 py-2">
                  <span className="w-8 shrink-0 font-bold text-marca">
                    {pr.cantidad}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{pr.nombre}</span>
                  <span className="shrink-0 text-suave">{dinero(pr.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Fila({ p }: { p: PedidoHistorial }) {
  const anulado = p.estado === 'anulado';

  return (
    <tr className={anulado ? 'text-suave line-through' : ''}>
      <td className="whitespace-nowrap px-4 py-2 text-suave">
        {hora(p.cerrado_en ?? p.creado_en)}
      </td>
      <td className="px-2 py-2">
        <Link href={`/pedido/${p.id}/recibo`} className="hover:text-marca">
          {p.id}
        </Link>
      </td>
      <td className="px-2 py-2">
        {p.mesa_nombre ?? NOMBRE_TIPO[p.tipo] ?? p.tipo}
        <span className="ml-1 text-xs text-suave">{p.items} items</span>
      </td>
      <td className="max-w-[14rem] truncate px-2 py-2">
        {p.cliente_nombre ?? '—'}
        {p.domiciliario_nombre && (
          <span className="ml-1 text-xs text-info">🛵 {p.domiciliario_nombre}</span>
        )}
      </td>
      <td className="px-2 py-2 text-xs">
        {anulado ? (
          <span className="text-alerta no-underline">anulado</span>
        ) : (
          <>
            {(p.metodos ?? '')
              .split(',')
              .filter(Boolean)
              .map(nombreMetodo)
              .join(' + ')}
            {p.cobrado_por && (
              <span className="block text-suave">{p.cobrado_por}</span>
            )}
          </>
        )}
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-right font-semibold">
        {dinero(p.total)}
      </td>
    </tr>
  );
}
