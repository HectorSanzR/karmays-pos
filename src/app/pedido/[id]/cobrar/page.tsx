import Link from 'next/link';
import { exigir } from '@/lib/sesion';
import { notFound } from 'next/navigation';
import { cajaAbierta, obtenerPedido } from '@/lib/consultas';
import { Recaudo } from '@/components/Recaudo';

export const dynamic = 'force-dynamic';

export default async function PaginaCobrar({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigir('cobrar');
  const { id } = await params;
  const pedido = await obtenerPedido(Number(id));
  if (!pedido) notFound();

  const caja = await cajaAbierta();

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Link href={`/pedido/${pedido.id}`} className="text-sm text-suave hover:text-texto">
        ← Volver al pedido
      </Link>

      {!caja ? (
        <div className="tarjeta space-y-3 p-6 text-center">
          <p className="text-lg font-semibold text-marca">La caja esta cerrada</p>
          <p className="text-sm text-suave">
            Abre la caja del dia para poder registrar cobros.
          </p>
          <Link href="/caja" className="btn-marca">
            Ir a caja
          </Link>
        </div>
      ) : (
        <Recaudo pedido={pedido} />
      )}
    </div>
  );
}
