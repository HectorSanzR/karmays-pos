import Link from 'next/link';
import { exigir } from '@/lib/sesion';
import { listarDomiciliarios, listarPedidos } from '@/lib/consultas';
import { crearPedidoDirecto } from '@/lib/acciones';
import { dinero, transcurrido } from '@/lib/formato';
import { EstadoChip } from '@/components/EstadoChip';
import { SelectorDomiciliario } from '@/components/SelectorDomiciliario';

export const dynamic = 'force-dynamic';

export default async function Domicilios() {
  await exigir('domicilios');

  const activos = listarPedidos('domicilio', [
    'abierto',
    'en_cocina',
    'listo',
    'en_camino',
    'entregado',
  ]);
  const cerrados = listarPedidos('domicilio', ['pagado']).slice(0, 12);
  const domiciliarios = listarDomiciliarios();

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[380px_1fr]">
      <section className="tarjeta h-fit p-4">
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

      <section className="space-y-4">
        <div className="tarjeta overflow-hidden">
          <h2 className="flex items-center justify-between border-b border-borde px-4 py-3 font-semibold">
            <span>En curso ({activos.length})</span>
            <Link href="/domiciliarios" className="text-xs font-normal text-suave hover:text-marca">
              Domiciliarios y liquidacion →
            </Link>
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
                          {p.cliente_nombre ?? `Pedido #${p.id}`}
                          <span className="ml-2 text-xs font-normal text-suave">
                            {p.cliente_telefono}
                          </span>
                        </p>
                        <p className="truncate text-xs text-suave">
                          {p.cliente_direccion}
                        </p>
                      </div>
                      <EstadoChip estado={p.estado} />
                      <span className="w-24 text-right font-semibold">
                        {dinero(p.total)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-suave">
                      #{p.id} · {transcurrido(p.creado_en)}
                    </p>
                  </Link>

                  <div className="mt-2">
                    <SelectorDomiciliario
                      pedidoId={p.id}
                      asignadoA={p.domiciliario_id}
                      estado={p.estado}
                      domiciliarios={domiciliarios}
                      conDespacho
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cerrados.length > 0 && (
          <div className="tarjeta overflow-hidden">
            <h2 className="border-b border-borde px-4 py-3 font-semibold">
              Entregados y cobrados
            </h2>
            <ul className="divide-y divide-borde text-sm">
              {cerrados.map((p) => (
                <li key={p.id} className="flex gap-3 px-4 py-2 text-suave">
                  <span className="flex-1 truncate">
                    #{p.id} {p.cliente_nombre}
                  </span>
                  <span>{dinero(p.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
