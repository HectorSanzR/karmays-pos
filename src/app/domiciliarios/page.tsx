import Link from 'next/link';
import { exigir } from '@/lib/sesion';
import {
  cajaAbierta,
  estadoDomiciliarios,
  listarPedidos,
  type ResumenPedido,
} from '@/lib/consultas';
import { crearUsuario } from '@/lib/acciones';
import { dinero, transcurrido } from '@/lib/formato';
import { EstadoChip } from '@/components/EstadoChip';
import { BotonDesactivar } from '@/components/BotonDesactivar';

export const dynamic = 'force-dynamic';

const ACTIVOS = ['abierto', 'en_cocina', 'listo', 'en_camino', 'entregado'];

export default async function Domiciliarios() {
  await exigir('domiciliarios');

  const gente = estadoDomiciliarios();
  const pedidos = listarPedidos('domicilio', ACTIVOS);
  const hayCaja = !!cajaAbierta();

  const porPersona = pedidos.reduce<Record<number, ResumenPedido[]>>((acc, p) => {
    if (p.domiciliario_id) (acc[p.domiciliario_id] ??= []).push(p);
    return acc;
  }, {});
  const sinAsignar = pedidos.filter((p) => !p.domiciliario_id);

  const totalEnCalle = gente.reduce((s, d) => s + d.por_cobrar, 0);
  const totalEfectivo = gente.reduce((s, d) => s + d.efectivo_turno, 0);

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[320px_1fr]">
      <section className="space-y-4">
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

        <div className="tarjeta space-y-2 p-4 text-sm">
          <h2 className="font-bold">Resumen del turno</h2>
          {!hayCaja && (
            <p className="text-xs text-marca">
              La caja esta cerrada: el efectivo del turno arranca en cero al abrirla.
            </p>
          )}
          <div className="flex justify-between text-suave">
            <span>En la calle sin cobrar</span>
            <span className="font-semibold text-marca">{dinero(totalEnCalle)}</span>
          </div>
          <div className="flex justify-between text-suave">
            <span>Efectivo ya liquidado</span>
            <span className="font-semibold text-ok">{dinero(totalEfectivo)}</span>
          </div>
          <div className="flex justify-between text-suave">
            <span>Sin asignar</span>
            <span className="font-semibold">{sinAsignar.length} pedidos</span>
          </div>
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
          <div className="grid gap-3 md:grid-cols-2">
            {gente.map((d) => {
              const suyos = porPersona[d.id] ?? [];
              return (
                <div key={d.id} className="tarjeta flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold">{d.nombre}</h3>
                      {d.telefono && (
                        <p className="text-xs text-suave">{d.telefono}</p>
                      )}
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

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <Dato n={d.en_ruta} t="en ruta" />
                    <Dato n={d.entregados} t="entregados" />
                    <Dato n={suyos.length} t="asignados" />
                  </div>

                  <dl className="mt-3 space-y-1 border-t border-borde pt-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-suave">Lleva sin cobrar</dt>
                      <dd className="font-semibold text-marca">
                        {dinero(d.por_cobrar)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-suave">Efectivo liquidado</dt>
                      <dd className="font-semibold text-ok">
                        {dinero(d.efectivo_turno)}
                      </dd>
                    </div>
                  </dl>

                  {suyos.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-borde pt-3 text-xs">
                      {suyos.map((p) => (
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Dato({ n, t }: { n: number; t: string }) {
  return (
    <div className="rounded-lg bg-panel2 py-2">
      <p className="text-xl font-bold">{n}</p>
      <p className="text-[11px] text-suave">{t}</p>
    </div>
  );
}
