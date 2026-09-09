import { notFound, redirect } from 'next/navigation';
import { exigir, puede, PERMISOS } from '@/lib/sesion';
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
  const usuario = await exigir();
  const { id } = await params;
  const pedido = await obtenerPedido(Number(id));
  if (!pedido) notFound();

  // Un mesero no abre la comanda de un domicilio, ni la recepcion la de una mesa.
  const seccion = pedido.tipo === 'mesa' ? 'mesas' : 'domicilios';
  if (!puede(usuario, seccion)) redirect(PERMISOS[usuario.rol].inicio);

  return (
    <TomaPedido
      pedido={pedido}
      categorias={await listarCategorias()}
      productos={await listarProductos()}
      ingredientes={await mapaIngredientes()}
      domiciliarios={await listarDomiciliarios()}
    />
  );
}
