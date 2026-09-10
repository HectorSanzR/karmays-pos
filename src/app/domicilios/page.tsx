import Link from 'next/link';
import { exigir } from '@/lib/sesion';
import { listarPedidos } from '@/lib/consultas';
import { crearPedidoDirecto } from '@/lib/acciones';
import { dinero, hora, numeroOrden, transcurrido } from '@/lib/formato';
import { EstadoChip } from '@/components/EstadoChip';

export const dynamic = 'force-dynamic';

export default async function Domicilios() {
  await exigir('domicilios');

  const activos = await listarPedidos('domicilio', [
    'abierto',
    'en_cocina',
    'listo',
    'en_camino',
    'entregado',
  ]);
  const cerrados = (await listarPedidos('domicilio', ['pagado'])).slice(0, 20);

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[380px_1fr]">
      <section className="tarjeta h-fit min-w-0 p-4">
        <h2 className="mb-4 text-lg font-bold">Nuevo domicilio</h2>
        <form action={crearPedidoDirecto} className="space-y-3">
          <input type="hidden" name="tipo" value="domicilio" />
          <div>
            <label className="etiqueta" htmlFor="cliente_nombre">
              Cliente
            </label>
            <input
              id="cliente_nombre"
              name="cliente_nombre"
              className="campo"
              placeholder="Nombre de quien pide"
              required
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="cliente_telefono">
              Telefono
            </label>
            <input
              id="cliente_telefono"
              name="cliente_telefono"
              className="campo"
              inputMode="tel"
              placeholder="300 000 0000"
              required
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="cliente_direccion">
              Direccion
            </label>
            <textarea
              id="cliente_direccion"
              name="cliente_direccion"
              className="campo"
              rows={2}
              placeholder="Calle 00 # 00-00, apto / barrio"
              required
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="valor_domicilio">
              Valor del domicilio
            </label>
            <input
              id="valor_domicilio"
              name="valor_domicilio"
              type="number"
              min={0}
              step={500}
              defaultValue={5000}
              className="campo"
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="cliente_notas">
              Indicaciones
            </label>
            <input
              id="cliente_notas"
              name="cliente_notas"
              className="campo"
              placeholder="Torre 2, timbre dañado, etc."
            />
          </div>
          <button type="submit" className="btn-marca w-full">
            Crear y tomar pedido
          </button>
        </form>
      </section>

      <section className="min-w-0 space-y-4">
        <div className="tarjeta overflow-hidden">
          <h2 className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-3 font-semibold">
            <span>En curso ({activos.length})</span>
            <span className="text-xs font-normal text-suave">
              Los asigna despacho
            </span>
          </h2>
          {activos.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-suave">
              No hay domicilios activos.
            </p>
          ) : (
            <ul className="divide-y divide-borde">
              {activos.map((p) => (
                <li key={p.id} className="px-4 py-3">
                  <Link href={`/pedido/${p.id}`} className="block group">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold group-hover:text-marca">
                          {p.cliente_nombre ?? `Orden ${numeroOrden(p.numero, p.id)}`}
                          <span className="ml-2 text-xs font-normal text-suave">
                            {p.cliente_telefono}
                          </span>
                        </p>
                        <p className="truncate text-xs text-suave">
                          {p.cliente_direccion}
                        </p>
                      </div>
                      <EstadoChip estado={p.estado} />
                      {p.pagado >= p.total && p.total > 0 && (
                        <span className="chip bg-ok/15 text-ok">Pagado</span>
                      )}
                      <span className="w-24 text-right font-semibold">
                        {dinero(p.total)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-suave">
                      {numeroOrden(p.numero, p.id)} · {transcurrido(p.creado_en)} · {p.items} items
                      {p.domiciliario_nombre ? ` · 🛵 ${p.domiciliario_nombre}` : ''}
                    </p>
                    {p.cliente_notas && (
                      <p className="truncate text-xs text-marca">{p.cliente_notas}</p>
                    )}
                  </Link>

                </li>
              ))}
            </ul>
          )}
        </div>

        {cerrados.length > 0 && (
          <div className="tarjeta overflow-hidden">
            <h2 className="border-b border-borde px-4 py-3 font-semibold">
              Ya entregados
            </h2>
            <ul className="divide-y divide-borde">
              {cerrados.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/pedido/${p.id}`}
                    className="group block px-4 py-3 transition hover:bg-panel2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold group-hover:text-marca">
                          {p.cliente_nombre ?? `Orden ${numeroOrden(p.numero, p.id)}`}
                          <span className="ml-2 text-xs font-normal text-suave">
                            {p.cliente_telefono}
                          </span>
                        </p>
                        <p className="truncate text-xs text-suave">
                          {p.cliente_direccion}
                        </p>
                      </div>
                      <span className="w-24 text-right font-semibold">
                        {dinero(p.total)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-suave">
                      {numeroOrden(p.numero, p.id)} · entregado {hora(p.cerrado_en)} · {p.items} items
                      {p.domiciliario_nombre ? ` · 🛵 ${p.domiciliario_nombre}` : ''}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
