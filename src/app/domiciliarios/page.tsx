import Link from 'next/link';
import { exigir } from '@/lib/sesion';
import {
  cajaAbierta,
  controlDomiciliarios,
  entregasDelDia,
  listarPedidos,
  type ControlDomiciliario,
  type EntregaDelDia,
  type ResumenPedido,
} from '@/lib/consultas';
import { crearUsuario } from '@/lib/acciones';
import { dinero, hora, inicioDelDia, nombreMetodo, transcurrido } from '@/lib/formato';
import { EstadoChip } from '@/components/EstadoChip';
import { BotonDesactivar } from '@/components/BotonDesactivar';

export const dynamic = 'force-dynamic';

const ACTIVOS = ['abierto', 'en_cocina', 'listo', 'en_camino', 'entregado'];

export default async function Domiciliarios() {
  await exigir('domiciliarios');

  const desde = inicioDelDia();
  const gente = controlDomiciliarios(desde);
  const entregas = entregasDelDia(desde);
  const pedidos = listarPedidos('domicilio', ACTIVOS);
  const hayCaja = !!cajaAbierta();

  const porPersona = pedidos.reduce<Record<number, ResumenPedido[]>>((acc, p) => {
    if (p.domiciliario_id) (acc[p.domiciliario_id] ??= []).push(p);
    return acc;
  }, {});
  const sinAsignar = pedidos.filter((p) => !p.domiciliario_id);

  // Totales del dia sumando a todo el mundo.
  const totales = gente.reduce(
    (acc, d) => {
      acc.cobrado += d.cobrado_hoy;
      acc.efectivo += d.efectivo_hoy;
      acc.digital += d.digital_hoy;
      acc.enCalle += d.por_cobrar;
      acc.entregas += d.entregas_hoy;
      acc.domicilios += d.domicilios_hoy;
      for (const m of d.porMetodo) {
        acc.metodos[m.metodo] = (acc.metodos[m.metodo] ?? 0) + m.monto;
      }
      return acc;
    },
    {
      cobrado: 0,
      efectivo: 0,
      digital: 0,
      enCalle: 0,
      entregas: 0,
      domicilios: 0,
      metodos: {} as Record<string, number>,
    },
  );

  const metodosOrdenados = Object.entries(totales.metodos).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[340px_1fr]">
      <section className="space-y-4">
        <div className="tarjeta p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">
            Domicilios de hoy
          </h2>
          <p className="mt-1 text-3xl font-bold text-marca">{dinero(totales.cobrado)}</p>
          <p className="text-xs text-suave">{totales.entregas} entregas cobradas</p>

          {metodosOrdenados.length > 0 ? (
            <dl className="mt-4 space-y-1 border-t border-borde pt-3 text-sm">
              {metodosOrdenados.map(([metodo, monto]) => (
                <div key={metodo} className="flex justify-between">
                  <dt className="text-suave">{nombreMetodo(metodo)}</dt>
                  <dd className="font-semibold">{dinero(monto)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 border-t border-borde pt-3 text-sm text-suave">
              Todavia no han cobrado nada hoy.
            </p>
          )}

          <dl className="mt-3 space-y-1 border-t border-borde pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-suave">Efectivo por recibir</dt>
              <dd className="font-bold text-ok">{dinero(totales.efectivo)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-suave">Ya entro al negocio</dt>
              <dd className="font-semibold">{dinero(totales.digital)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-suave">En la calle sin cobrar</dt>
              <dd className="font-bold text-marca">{dinero(totales.enCalle)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-suave">Cobrado en domicilios</dt>
              <dd className="font-semibold">{dinero(totales.domicilios)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-suave">Sin asignar</dt>
              <dd className="font-semibold">{sinAsignar.length} pedidos</dd>
            </div>
          </dl>

          {!hayCaja && (
            <p className="mt-3 text-xs text-marca">
              La caja esta cerrada: nadie puede registrar cobros ahora mismo.
            </p>
          )}
        </div>

        <div className="tarjeta p-4">
          <h2 className="mb-4 text-lg font-bold">Nuevo domiciliario</h2>
          <form action={crearUsuario} className="space-y-3">
            <input type="hidden" name="rol" value="domiciliario" />
            <div>
              <label className="etiqueta" htmlFor="nombre">
                Nombre
              </label>
              <input
                id="nombre"
                name="nombre"
                className="campo"
                placeholder="Como lo llaman"
                required
              />
            </div>
            <div>
              <label className="etiqueta" htmlFor="telefono">
                Telefono
              </label>
              <input
                id="telefono"
                name="telefono"
                className="campo"
                inputMode="tel"
                placeholder="300 000 0000"
              />
            </div>
            <button type="submit" className="btn-marca w-full">
              Agregar
            </button>
            <p className="text-xs text-suave">
              Al crearlo se genera su codigo de acceso, que aparece en su ficha.
            </p>
          </form>
        </div>
      </section>

      <section className="space-y-4">
        {sinAsignar.length > 0 && (
          <div className="tarjeta border-marca/40 p-4">
            <h2 className="mb-2 font-semibold text-marca">
              {sinAsignar.length} domicilio(s) sin domiciliario
            </h2>
            <ul className="space-y-1 text-sm">
              {sinAsignar.map((p) => (
                <li key={p.id}>
                  <Link href={`/pedido/${p.id}`} className="hover:text-marca">
                    #{p.id} · {p.cliente_nombre} · {dinero(p.total)}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/domicilios"
              className="mt-3 inline-block text-xs text-suave hover:text-marca"
            >
              Asignarlos en la lista de domicilios →
            </Link>
          </div>
        )}

        {gente.length === 0 ? (
          <div className="tarjeta p-10 text-center text-sm text-suave">
            Todavia no hay domiciliarios. Agrega el primero a la izquierda.
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {gente.map((d) => (
              <Ficha
                key={d.id}
                d={d}
                enRuta={porPersona[d.id] ?? []}
                entregas={entregas.filter((e) => e.domiciliario_id === d.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Ficha({
  d,
  enRuta,
  entregas,
}: {
  d: ControlDomiciliario;
  enRuta: ResumenPedido[];
  entregas: EntregaDelDia[];
}) {
  return (
    <div className="tarjeta flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold">{d.nombre}</h3>
          {d.telefono && <p className="text-xs text-suave">{d.telefono}</p>}
          {d.codigo && (
            <p className="mt-1 text-xs text-suave">
              Codigo:{' '}
              <span className="font-mono text-base font-bold tracking-widest text-marca">
                {d.codigo}
              </span>
            </p>
          )}
        </div>
        <BotonDesactivar id={d.id} nombre={d.nombre} />
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-borde pt-3">
        <div>
          <p className="text-xs text-suave">Cobrado hoy</p>
          <p className="text-2xl font-bold text-marca">{dinero(d.cobrado_hoy)}</p>
        </div>
        <p className="text-sm text-suave">
          {d.entregas_hoy} entrega{d.entregas_hoy === 1 ? '' : 's'} · {d.en_ruta} en ruta
        </p>
      </div>

      {d.porMetodo.length > 0 && (
        <dl className="mt-3 space-y-1 text-sm">
          {d.porMetodo.map((m) => (
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
          <dt className="text-suave">Efectivo que debe entregar</dt>
          <dd className="text-base font-bold text-ok">{dinero(d.efectivo_hoy)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-suave">Lleva sin cobrar</dt>
          <dd className="font-bold text-marca">{dinero(d.por_cobrar)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-suave">Cobrado en domicilios</dt>
          <dd className="font-semibold">{dinero(d.domicilios_hoy)}</dd>
        </div>
      </dl>

      {enRuta.length > 0 && (
        <div className="mt-3 border-t border-borde pt-3">
          <p className="etiqueta">En la calle ahora</p>
          <ul className="space-y-1 text-xs">
            {enRuta.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/pedido/${p.id}`}
                  className="flex items-center gap-2 hover:text-marca"
                >
                  <span className="min-w-0 flex-1 truncate">
                    #{p.id} {p.cliente_direccion}
                  </span>
                  <EstadoChip estado={p.estado} />
                  <span className="whitespace-nowrap text-suave">
                    {transcurrido(p.creado_en)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {entregas.length > 0 && (
        <details className="mt-3 border-t border-borde pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-suave">
            Ver las {entregas.length} entregas de hoy
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {entregas.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <span className="w-10 shrink-0 text-suave">{hora(e.cerrado_en)}</span>
                <span className="min-w-0 flex-1 truncate">
                  #{e.id} {e.cliente_nombre}
                </span>
                <span className="shrink-0 text-suave">
                  {(e.metodos ?? '')
                    .split(',')
                    .filter(Boolean)
                    .map(nombreMetodo)
                    .join(' + ')}
                </span>
                <span className="w-20 shrink-0 text-right font-semibold">
                  {dinero(e.total)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
