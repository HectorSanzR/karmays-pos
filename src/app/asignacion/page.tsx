import Link from 'next/link';
import { exigir } from '@/lib/sesion';
import {
  cajaAbierta,
  controlDomiciliarios,
  listarPedidos,
  type ResumenPedido,
} from '@/lib/consultas';
import { dinero, numeroOrden, transcurrido } from '@/lib/formato';
import { EstadoChip } from '@/components/EstadoChip';
import {
  SelectorDomiciliario,
  type OpcionDomiciliario,
} from '@/components/SelectorDomiciliario';

export const dynamic = 'force-dynamic';

const ACTIVOS = ['abierto', 'en_cocina', 'listo', 'en_camino', 'entregado'];

/**
 * Despacho: quien reparte los domicilios entre los domiciliarios. Esta
 * separado de la toma de pedidos a proposito, para que no sea la misma
 * persona la que recibe y la que asigna.
 */
export default async function Asignacion() {
  await exigir('asignacion');

  const pedidos = await listarPedidos('domicilio', ACTIVOS);
  const caja = await cajaAbierta();
  const gente = await controlDomiciliarios(caja?.id ?? null);

  // Los mismos nombres del panel de la derecha, pero como recuadros para
  // tocar. Va la carga de cada uno: es lo que decide a quien se le entrega.
  const domiciliarios: OpcionDomiciliario[] = gente.map((d) => ({
    id: d.id,
    nombre: d.nombre,
    en_ruta: d.en_ruta,
  }));

  const sinAsignar = pedidos.filter((p) => !p.domiciliario_id);
  const porDespachar = pedidos.filter(
    (p) => p.domiciliario_id && p.estado !== 'en_camino' && p.estado !== 'entregado',
  );
  const enCalle = pedidos.filter(
    (p) => p.domiciliario_id && (p.estado === 'en_camino' || p.estado === 'entregado'),
  );

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_300px]">
      <section className="min-w-0 space-y-4">
        <Grupo
          titulo="Sin asignar"
          vacio="Todo lo que hay tiene domiciliario."
          resaltado
          pedidos={sinAsignar}
          domiciliarios={domiciliarios}
        />
        <Grupo
          titulo="Asignados, sin salir"
          vacio="Nada esperando para salir."
          pedidos={porDespachar}
          domiciliarios={domiciliarios}
        />
        <Grupo
          titulo="En la calle"
          vacio="Ningun domiciliario esta afuera."
          pedidos={enCalle}
          domiciliarios={domiciliarios}
        />
      </section>

      <aside className="min-w-0 space-y-4">
        <div className="tarjeta p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-suave">
            Quien esta libre
          </h2>
          {gente.length === 0 ? (
            <p className="text-sm text-suave">No hay domiciliarios activos.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {gente.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">{d.nombre}</span>
                  <span
                    className={`chip shrink-0 ${
                      d.en_ruta === 0
                        ? 'bg-ok/15 text-ok'
                        : 'bg-info/15 text-info'
                    }`}
                  >
                    {d.en_ruta === 0 ? 'libre' : `${d.en_ruta} en ruta`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/domiciliarios"
            className="mt-3 inline-block text-xs text-suave hover:text-marca"
          >
            Ver liquidacion de cada uno →
          </Link>
        </div>

        {!caja && (
          <p className="rounded-lg border border-marca/40 bg-marca/10 px-3 py-2 text-sm text-marca">
            La caja esta cerrada: se puede despachar, pero nadie va a poder
            registrar el cobro hasta que la abran.
          </p>
        )}
      </aside>
    </div>
  );
}

function Grupo({
  titulo,
  vacio,
  pedidos,
  domiciliarios,
  resaltado = false,
}: {
  titulo: string;
  vacio: string;
  pedidos: ResumenPedido[];
  domiciliarios: OpcionDomiciliario[];
  resaltado?: boolean;
}) {
  return (
    <div className={`tarjeta overflow-hidden ${resaltado && pedidos.length > 0 ? 'border-marca/50' : ''}`}>
      <h2
        className={`border-b border-borde px-4 py-3 font-semibold ${
          resaltado && pedidos.length > 0 ? 'text-marca' : ''
        }`}
      >
        {titulo} ({pedidos.length})
      </h2>

      {pedidos.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-suave">{vacio}</p>
      ) : (
        <ul className="divide-y divide-borde">
          {pedidos.map((p) => (
            <li key={p.id} className="px-4 py-3">
              <Link href={`/pedido/${p.id}`} className="group block">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold group-hover:text-marca">
                    {p.cliente_nombre ?? `Orden ${numeroOrden(p.numero, p.id)}`}
                  </span>
                  <EstadoChip estado={p.estado} />
                  {p.pagado >= p.total && p.total > 0 && (
                    <span className="chip bg-ok/15 text-ok">Pagado</span>
                  )}
                  <span className="font-semibold">{dinero(p.total)}</span>
                </div>
                <p className="truncate text-sm text-suave">{p.cliente_direccion}</p>
                <p className="text-xs text-suave">
                  {numeroOrden(p.numero, p.id)} · {transcurrido(p.creado_en)} ·{' '}
                  {p.items} items
                  {p.cliente_telefono ? ` · ${p.cliente_telefono}` : ''}
                </p>
                {p.cliente_notas && (
                  <p className="truncate text-xs text-marca">{p.cliente_notas}</p>
                )}
              </Link>

              <div className="mt-2">
                <SelectorDomiciliario
                  pedidoId={p.id}
                  asignadoA={p.domiciliario_id}
                  asignadoNombre={p.domiciliario_nombre}
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
  );
}
