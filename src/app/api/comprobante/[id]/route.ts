import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { puede, usuarioActual } from '@/lib/sesion';

export const dynamic = 'force-dynamic';

/** Devuelve la imagen del comprobante, solo a quien tiene por que verla. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuario = await usuarioActual();
  if (!usuario) return new NextResponse('Sin sesion', { status: 401 });

  const { id } = await params;
  const fila = (await db.get(
    `SELECT c.bytes, c.mime, p.domiciliario_id
       FROM comprobantes c
       JOIN pedidos p ON p.id = c.pedido_id
      WHERE c.id = ?`,
    Number(id),
  )) as { bytes: Buffer; mime: string; domiciliario_id: number | null } | undefined;

  if (!fila) return new NextResponse('No existe', { status: 404 });

  const suyo =
    usuario.domiciliario_id !== null &&
    fila.domiciliario_id === usuario.domiciliario_id;
  if (!puede(usuario, 'cobrar') && !suyo) {
    return new NextResponse('Sin permiso', { status: 403 });
  }

  return new NextResponse(new Uint8Array(fila.bytes), {
    headers: {
      'Content-Type': fila.mime,
      // Es plata: que no quede en cachés intermedias.
      'Cache-Control': 'private, no-store',
    },
  });
}
