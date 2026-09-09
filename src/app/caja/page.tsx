import { cajaAbierta, listarPedidos, resumenCaja } from '@/lib/consultas';
import { exigir } from '@/lib/sesion';
import { abrirCaja, cerrarCaja } from '@/lib/acciones';
import { dinero, hora, nombreMetodo } from '@/lib/formato';

export const dynamic = 'force-dynamic';

export default async function Caja() {
  await exigir('caja');

  const sesion = await cajaAbierta();

  if (!sesion) {
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="tarjeta space-y-4 p-6">
          <h1 className="text-xl font-bold">Abrir caja</h1>
          <p className="text-sm text-suave">
            Registra con cuanto efectivo arranca el turno. Sin caja abierta no se
            pueden cobrar pedidos.
          </p>
          <form action={abrirCaja} className="space-y-3">
            <div>
              <label className="etiqueta" htmlFor="base">
                Base inicial
              </label>
              <input
                id="base"
                name="base"
                type="number"
                min={0}
                step={1000}
                defaultValue={100000}
                className="campo text-xl font-bold"
              />
            </div>
            <button type="submit" className="btn-marca w-full py-4">
              Abrir caja
            </button>
          </form>
        </div>
      </div>
    );
  }

  const r = await resumenCaja(sesion);
  const abiertos = await listarPedidos(undefined, [
    'abierto',
    'en_cocina',
    'listo',
    'en_camino',
    'entregado',
  ]);

  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-4 lg:grid-cols-2">
      <section className="tarjeta min-w-0 space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Caja del turno</h1>
          <span className="chip bg-ok/15 text-ok">Abierta {hora(sesion.abierta_en)}</span>
        </div>

        <div className="space-y-2 text-sm">
          <Fila k="Base inicial" v={dinero(sesion.base)} />
          <div className="border-t border-borde pt-2" />
          {r.porMetodo.length === 0 && (
            <p className="py-2 text-suave">Aun no hay cobros en este turno.</p>
          )}
          {r.porMetodo.map((m) => (
            <Fila
              key={m.metodo}
              k={`${nombreMetodo(m.metodo)} (${m.n})`}
              v={dinero(m.monto)}
            />
          ))}
          <div className="flex justify-between border-t border-borde pt-2 text-lg font-bold">
            <span>Ventas del turno</span>
            <span className="text-marca">{dinero(r.ventas)}</span>
          </div>
          <Fila k="Propinas incluidas" v={dinero(r.propinas)} />
          <Fila k="Domicilios cobrados" v={dinero(r.domicilios)} />
          <Fila k="Pedidos cerrados" v={String(r.pedidosPagados)} />
          <div className="flex justify-between border-t border-borde pt-2 text-lg font-bold">
            <span>Debe haber en caja</span>
            <span className="text-ok">{dinero(r.esperadoEnCaja)}</span>
          </div>
          <p className="text-xs text-suave">Base + efectivo recaudado.</p>
        </div>
      </section>

      <section className="tarjeta h-fit min-w-0 space-y-4 p-6">
        <h2 className="text-lg font-bold">Cierre de caja</h2>

        {abiertos.length > 0 ? (
          <div className="rounded-lg border border-marca/40 bg-marca/10 p-3 text-sm text-marca">
            Hay {abiertos.length} pedido(s) sin cobrar. Cierralos o anulalos antes de
            cuadrar la caja.
            <ul className="mt-2 space-y-1 text-xs">
              {abiertos.map((p) => (
                <li key={p.id}>
                  #{p.id} · {p.mesa_nombre ?? p.cliente_nombre ?? p.tipo} ·{' '}
                  {dinero(p.total)}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <form action={cerrarCaja} className="space-y-3">
            <div>
              <label className="etiqueta" htmlFor="conteo_final">
                Efectivo contado
              </label>
              <input
                id="conteo_final"
                name="conteo_final"
                type="number"
                min={0}
                step={100}
                defaultValue={r.esperadoEnCaja}
                className="campo text-xl font-bold"
              />
              <p className="mt-1 text-xs text-suave">
                Esperado: {dinero(r.esperadoEnCaja)}
              </p>
            </div>
            <div>
              <label className="etiqueta" htmlFor="notas">
                Notas del cierre
              </label>
              <input
                id="notas"
                name="notas"
                className="campo"
                placeholder="Faltante, sobrante, retiros..."
              />
            </div>
            <button type="submit" className="btn-marca w-full py-4">
              Cerrar caja
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-suave">
      <span>{k}</span>
      <span className="text-texto">{v}</span>
    </div>
  );
}
