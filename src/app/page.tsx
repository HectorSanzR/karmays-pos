import Link from 'next/link';
import { cajaAbierta, listarMesasConEstado, listarPedidos } from '@/lib/consultas';
import { dinero, transcurrido } from '@/lib/formato';
import { EstadoChip } from '@/components/EstadoChip';

export const dynamic = 'force-dynamic';

export default function Inicio() {
  const caja = cajaAbierta();
  const mesas = listarMesasConEstado();
  const activos = listarPedidos(undefined, [
    'abierto',
    'en_cocina',
    'listo',
    'en_camino',
    'entregado',
  ]);

  const ocupadas = mesas.filter((m) => m.pedido_id).length;
  const domicilios = activos.filter((p) => p.tipo === 'domicilio');
  const enSalon = activos.filter((p) => p.tipo !== 'domicilio');
  const porCobrar = activos.reduce((s, p) => s + p.total, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      {!caja && (
        <Link
          href="/caja"
          className="flex items-center justify-between rounded-xl border border-marca/40 bg-marca/10 px-4 py-3"
        >
          <span className="font-semibold text-marca">
            La caja esta cerrada — no se pueden registrar cobros.
          </span>
          <span className="text-sm text-marca">Abrir caja →</span>
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/mesas"
          className="tarjeta group p-5 transition hover:border-marca"
        >
          <p className="text-sm text-suave">Salon</p>
          <p className="mt-1 text-3xl font-bold">
            {ocupadas}
            <span className="text-lg text-suave">/{mesas.length}</span>
          </p>
          <p className="mt-1 text-sm text-suave group-hover:text-marca">
            Mesas ocupadas →
          </p>
        </Link>

        <Link
          href="/domicilios"
          className="tarjeta group p-5 transition hover:border-marca"
        >
          <p className="text-sm text-suave">Domicilios activos</p>
          <p className="mt-1 text-3xl font-bold">{domicilios.length}</p>
          <p className="mt-1 text-sm text-suave group-hover:text-marca">
            Ver despachos →
          </p>
        </Link>

        <div className="tarjeta p-5">
          <p className="text-sm text-suave">Por cobrar ahora</p>
          <p className="mt-1 text-3xl font-bold text-marca">{dinero(porCobrar)}</p>
          <p className="mt-1 text-sm text-suave">{activos.length} pedidos abiertos</p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <ListaPedidos titulo="En salon y para llevar" pedidos={enSalon} />
        <ListaPedidos titulo="Domicilios" pedidos={domicilios} />
      </section>
    </div>
  );
}

function ListaPedidos({
  titulo,
  pedidos,
}: {
  titulo: string;
  pedidos: ReturnType<typeof listarPedidos>;
}) {
  return (
    <div className="tarjeta overflow-hidden">
      <h2 className="border-b border-borde px-4 py-3 font-semibold">{titulo}</h2>
      {pedidos.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-suave">Nada pendiente.</p>
      ) : (
        <ul className="divide-y divide-borde">
          {pedidos.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pedido/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-panel2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {p.mesa_nombre ?? p.cliente_nombre ?? `Pedido #${p.id}`}
                  </p>
                  <p className="text-xs text-suave">
                    #{p.id} · {p.items} items · {transcurrido(p.creado_en)}
                  </p>
                </div>
                <EstadoChip estado={p.estado} />
                <span className="w-24 text-right font-semibold">{dinero(p.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
