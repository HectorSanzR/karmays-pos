import Link from 'next/link';
import { exigir } from '@/lib/sesion';
import { listarMesasConEstado } from '@/lib/consultas';
import { irAMesa } from '@/lib/acciones';
import { dinero, transcurrido } from '@/lib/formato';
import type { MesaConEstado } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

export default async function Mesas() {
  await exigir('mesas');

  const mesas = await listarMesasConEstado();

  const zonas = mesas.reduce<Record<string, MesaConEstado[]>>((acc, m) => {
    (acc[m.zona] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mesas</h1>
        <p className="text-sm text-suave">
          {mesas.filter((m) => m.pedido_id).length} de {mesas.length} ocupadas
        </p>
      </div>

      {Object.entries(zonas).map(([zona, lista]) => (
        <section key={zona} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">
            {zona}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {lista.map((m) => (
              <Tarjeta key={m.id} mesa={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Tarjeta({ mesa }: { mesa: MesaConEstado }) {
  if (mesa.pedido_id) {
    return (
      <Link
        href={`/pedido/${mesa.pedido_id}`}
        className="flex h-32 flex-col justify-between rounded-xl border-2 border-marca bg-marca/10 p-3 transition active:scale-[.98]"
      >
        <div className="flex items-start justify-between">
          <span className="font-bold">{mesa.nombre}</span>
          <span className="text-xs text-marca">{transcurrido(mesa.abierta_desde)}</span>
        </div>
        <div>
          <p className="text-lg font-bold text-marca">{dinero(mesa.total)}</p>
          <p className="text-xs text-suave">{mesa.items} items</p>
        </div>
      </Link>
    );
  }

  return (
    <form action={irAMesa} className="contents">
      <input type="hidden" name="mesa_id" value={mesa.id} />
      <input type="hidden" name="comensales" value={mesa.capacidad} />
      <button
        type="submit"
        className="flex h-32 flex-col justify-between rounded-xl border border-borde bg-panel p-3 text-left transition hover:border-suave active:scale-[.98]"
      >
        <span className="font-bold">{mesa.nombre}</span>
        <span>
          <span className="block text-sm text-suave">Libre</span>
          <span className="block text-xs text-suave/70">
            {mesa.capacidad} puestos
          </span>
        </span>
      </button>
    </form>
  );
}
