import { NextResponse } from 'next/server';
import { db, ahora } from '@/lib/db';
import { obtenerPedido } from '@/lib/consultas';
import { puede, usuarioActual } from '@/lib/sesion';

export const dynamic = 'force-dynamic';

/** La aplicacion achica la foto antes de subirla; esto es solo el tope duro. */
const TOPE_BYTES = 5 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Guarda la foto del comprobante de un pago: la pantalla de Nequi, Bre-B o la
 * transferencia. Se guarda en la base para no depender de otro servicio.
 */
export async function POST(req: Request) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: 'Sin sesion' }, { status: 401 });
  }

  const form = await req.formData();
  const pedidoId = Number(form.get('pedido_id'));
  const archivo = form.get('archivo');

  if (!Number.isInteger(pedidoId) || !(archivo instanceof File)) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }
  if (!TIPOS.includes(archivo.type)) {
    return NextResponse.json({ error: 'Solo se aceptan imagenes' }, { status: 415 });
  }
  if (archivo.size > TOPE_BYTES) {
    return NextResponse.json({ error: 'La imagen pesa demasiado' }, { status: 413 });
  }

  const pedido = await obtenerPedido(pedidoId);
  if (!pedido) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  }

  // Lo sube quien cobra, o el domiciliario a quien le tocó ese pedido.
  const suyo =
    usuario.domiciliario_id !== null &&
    pedido.domiciliario_id === usuario.domiciliario_id;
  if (!puede(usuario, 'cobrar') && !suyo) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const bytes = Buffer.from(await archivo.arrayBuffer());

  const id = await db.run(
    `INSERT INTO comprobantes (pedido_id, mime, bytes, tamano, nota, usuario_id, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    pedidoId,
    archivo.type,
    bytes,
    bytes.length,
    String(form.get('nota') || '').trim() || null,
    usuario.id,
    ahora(),
  );

  return NextResponse.json({ ok: true, id });
}
