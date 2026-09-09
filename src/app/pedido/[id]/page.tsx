import { notFound } from 'next/navigation';
import {
  listarCategorias,
  listarDomiciliarios,
  listarProductos,
  mapaIngredientes,
  obtenerPedido,
} from '@/lib/consultas';
import { TomaPedido } from '@/components/TomaPedido';

export const dynamic = 'force-dynamic';

export default async function PaginaPedido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = obtenerPedido(Number(id));
  if (!pedido) notFound();

  return (
    <TomaPedido
      pedido={pedido}
      categorias={listarCategorias()}
      productos={listarProductos()}
      ingredientes={mapaIngredientes()}
      domiciliarios={listarDomiciliarios()}
    />
  );
}
