'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, ahora } from './db';
import { cajaAbierta, obtenerPedido, pedidoAbiertoDeMesa } from './consultas';
import type { MetodoPago, TipoPedido } from './tipos';

function refrescar() {
  revalidatePath('/', 'layout');
}

/* -------------------------------------------------------- abrir pedidos -- */

/** Abre la mesa si esta libre y devuelve el id del pedido. Idempotente. */
export async function abrirMesa(mesaId: number, comensales = 2): Promise<number> {
  const existente = pedidoAbiertoDeMesa(mesaId);
  if (existente) return existente;

  const r = db
    .prepare(
      `INSERT INTO pedidos (tipo, estado, mesa_id, comensales, creado_en)
       VALUES ('mesa', 'abierto', ?, ?, ?)`,
    )
    .run(mesaId, comensales, ahora());
  refrescar();
  return Number(r.lastInsertRowid);
}

export async function irAMesa(formData: FormData) {
  const mesaId = Number(formData.get('mesa_id'));
  const comensales = Number(formData.get('comensales') || 2);
  const id = await abrirMesa(mesaId, comensales);
  redirect(`/pedido/${id}`);
}

export async function crearPedidoDirecto(formData: FormData) {
  const tipo = String(formData.get('tipo') || 'domicilio') as TipoPedido;
  const r = db
    .prepare(
      `INSERT INTO pedidos
         (tipo, estado, cliente_nombre, cliente_telefono, cliente_direccion,
          cliente_notas, valor_domicilio, creado_en)
       VALUES (?, 'abierto', ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      tipo,
      String(formData.get('cliente_nombre') || '').trim() || null,
      String(formData.get('cliente_telefono') || '').trim() || null,
      String(formData.get('cliente_direccion') || '').trim() || null,
      String(formData.get('cliente_notas') || '').trim() || null,
      Number(formData.get('valor_domicilio') || 0),
      ahora(),
    );
  refrescar();
  redirect(`/pedido/${Number(r.lastInsertRowid)}`);
}

/* ---------------------------------------------------------------- items -- */

export async function agregarItem(
  pedidoId: number,
  productoId: number,
  cantidad = 1,
  notas = '',
) {
  const p = db
    .prepare('SELECT nombre, precio FROM productos WHERE id = ?')
    .get(productoId) as unknown as { nombre: string; precio: number } | undefined;
  if (!p) throw new Error('Producto no encontrado');

  const limpias = notas.trim();

  // Si ya existe una linea identica y aun no se envia a cocina, solo suma.
  const igual = db
    .prepare(
      `SELECT id, cantidad FROM pedido_items
        WHERE pedido_id = ? AND producto_id = ? AND estado = 'pendiente'
          AND COALESCE(notas, '') = ?
        LIMIT 1`,
    )
    .get(pedidoId, productoId, limpias) as unknown as
    | { id: number; cantidad: number }
    | undefined;

  if (igual) {
    db.prepare('UPDATE pedido_items SET cantidad = cantidad + ? WHERE id = ?').run(
      cantidad,
      igual.id,
    );
  } else {
    db.prepare(
      `INSERT INTO pedido_items
         (pedido_id, producto_id, nombre, precio_unit, cantidad, notas, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(pedidoId, productoId, p.nombre, p.precio, cantidad, limpias || null, ahora());
  }
  refrescar();
}

export async function cambiarCantidad(itemId: number, delta: number) {
  const it = db
    .prepare('SELECT cantidad FROM pedido_items WHERE id = ?')
    .get(itemId) as unknown as { cantidad: number } | undefined;
  if (!it) return;

  const nueva = it.cantidad + delta;
  if (nueva <= 0) {
    db.prepare('DELETE FROM pedido_items WHERE id = ?').run(itemId);
  } else {
    db.prepare('UPDATE pedido_items SET cantidad = ? WHERE id = ?').run(nueva, itemId);
  }
  refrescar();
}

export async function quitarItem(itemId: number) {
  db.prepare('DELETE FROM pedido_items WHERE id = ?').run(itemId);
  refrescar();
}

export async function editarNotas(itemId: number, notas: string) {
  db.prepare('UPDATE pedido_items SET notas = ? WHERE id = ?').run(
    notas.trim() || null,
    itemId,
  );
  refrescar();
}

/* -------------------------------------------------------------- pedidos -- */

export async function enviarACocina(pedidoId: number) {
  db.prepare(
    `UPDATE pedido_items SET estado = 'enviado'
      WHERE pedido_id = ? AND estado = 'pendiente'`,
  ).run(pedidoId);
  db.prepare(
    `UPDATE pedidos SET estado = 'en_cocina'
      WHERE id = ? AND estado = 'abierto'`,
  ).run(pedidoId);
  refrescar();
}

export async function cambiarEstadoPedido(pedidoId: number, estado: string) {
  db.prepare('UPDATE pedidos SET estado = ? WHERE id = ?').run(estado, pedidoId);
  refrescar();
}

export async function actualizarPedido(formData: FormData) {
  const id = Number(formData.get('pedido_id'));
  db.prepare(
    `UPDATE pedidos
        SET cliente_nombre    = ?,
            cliente_telefono  = ?,
            cliente_direccion = ?,
            cliente_notas     = ?,
            domiciliario_id   = ?,
            valor_domicilio   = ?,
            descuento         = ?,
            comensales        = ?
      WHERE id = ?`,
  ).run(
    String(formData.get('cliente_nombre') || '').trim() || null,
    String(formData.get('cliente_telefono') || '').trim() || null,
    String(formData.get('cliente_direccion') || '').trim() || null,
    String(formData.get('cliente_notas') || '').trim() || null,
    Number(formData.get('domiciliario_id')) || null,
    Number(formData.get('valor_domicilio') || 0),
    Number(formData.get('descuento') || 0),
    Number(formData.get('comensales') || 0) || null,
    id,
  );
  refrescar();
}

export async function anularPedido(pedidoId: number) {
  db.prepare(
    `UPDATE pedidos SET estado = 'anulado', cerrado_en = ? WHERE id = ?`,
  ).run(ahora(), pedidoId);
  refrescar();
  redirect('/');
}

/* -------------------------------------------------------- domiciliarios -- */

export async function crearDomiciliario(formData: FormData) {
  const nombre = String(formData.get('nombre') || '').trim();
  if (!nombre) return;
  db.prepare(
    `INSERT INTO domiciliarios (nombre, telefono) VALUES (?, ?)
     ON CONFLICT(nombre) DO UPDATE SET activo = 1, telefono = excluded.telefono`,
  ).run(nombre, String(formData.get('telefono') || '').trim() || null);
  refrescar();
}

/** Asigna o desasigna (domiciliarioId = null) el pedido. */
export async function asignarDomiciliario(
  pedidoId: number,
  domiciliarioId: number | null,
) {
  db.prepare('UPDATE pedidos SET domiciliario_id = ? WHERE id = ?').run(
    domiciliarioId,
    pedidoId,
  );
  refrescar();
}

/** Asignar y despachar en un solo gesto: es lo que se hace al entregarle
 *  la bolsa al domiciliario. */
export async function despachar(pedidoId: number, domiciliarioId: number) {
  db.prepare(
    `UPDATE pedidos SET domiciliario_id = ?, estado = 'en_camino' WHERE id = ?`,
  ).run(domiciliarioId, pedidoId);
  refrescar();
}

export async function activarDomiciliario(id: number, activo: boolean) {
  db.prepare('UPDATE domiciliarios SET activo = ? WHERE id = ?').run(activo ? 1 : 0, id);
  refrescar();
}

/* -------------------------------------------------------------- recaudo -- */

export async function fijarPropina(pedidoId: number, monto: number) {
  db.prepare('UPDATE pedidos SET propina = ? WHERE id = ?').run(
    Math.max(0, Math.round(monto)),
    pedidoId,
  );
  refrescar();
}

export interface ResultadoPago {
  ok: boolean;
  error?: string;
  cambio?: number;
  cerrado?: boolean;
}

export async function registrarPago(
  pedidoId: number,
  metodo: MetodoPago,
  monto: number,
  recibido?: number,
  referencia?: string,
): Promise<ResultadoPago> {
  const sesion = cajaAbierta();
  if (!sesion) return { ok: false, error: 'No hay caja abierta. Abre la caja del dia.' };

  const pedido = obtenerPedido(pedidoId);
  if (!pedido) return { ok: false, error: 'Pedido no encontrado' };
  if (pedido.estado === 'pagado') return { ok: false, error: 'El pedido ya esta pagado' };

  const cobro = Math.round(monto);
  if (cobro <= 0) return { ok: false, error: 'El monto debe ser mayor a cero' };
  if (cobro > pedido.cuenta.saldo) {
    return { ok: false, error: 'El monto supera el saldo pendiente' };
  }

  const cambio =
    metodo === 'efectivo' && recibido ? Math.max(0, Math.round(recibido) - cobro) : 0;

  db.prepare(
    `INSERT INTO pagos
       (pedido_id, metodo, monto, recibido, cambio, referencia, caja_sesion_id, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    pedidoId,
    metodo,
    cobro,
    recibido ? Math.round(recibido) : null,
    cambio,
    referencia?.trim() || null,
    sesion.id,
    ahora(),
  );

  const saldo = pedido.cuenta.saldo - cobro;
  if (saldo <= 0) {
    db.prepare(
      `UPDATE pedidos SET estado = 'pagado', cerrado_en = ?, caja_sesion_id = ?
        WHERE id = ?`,
    ).run(ahora(), sesion.id, pedidoId);
  }

  refrescar();
  return { ok: true, cambio, cerrado: saldo <= 0 };
}

export async function anularPago(pagoId: number) {
  const pago = db
    .prepare('SELECT pedido_id FROM pagos WHERE id = ?')
    .get(pagoId) as unknown as { pedido_id: number } | undefined;
  if (!pago) return;

  db.prepare('DELETE FROM pagos WHERE id = ?').run(pagoId);
  db.prepare(
    `UPDATE pedidos SET estado = 'abierto', cerrado_en = NULL, caja_sesion_id = NULL
      WHERE id = ? AND estado = 'pagado'`,
  ).run(pago.pedido_id);
  refrescar();
}

/* ----------------------------------------------------------------- caja -- */

export async function abrirCaja(formData: FormData) {
  if (cajaAbierta()) return;
  db.prepare('INSERT INTO caja_sesiones (base, abierta_en) VALUES (?, ?)').run(
    Number(formData.get('base') || 0),
    ahora(),
  );
  refrescar();
}

export async function cerrarCaja(formData: FormData) {
  const sesion = cajaAbierta();
  if (!sesion) return;

  const pendientes = db
    .prepare(
      `SELECT COUNT(*) AS n FROM pedidos WHERE estado NOT IN ('pagado', 'anulado')`,
    )
    .get() as unknown as { n: number };
  if (pendientes.n > 0) {
    throw new Error(
      `Hay ${pendientes.n} pedido(s) sin cerrar. Cobralos o anulalos antes del cierre.`,
    );
  }

  db.prepare(
    'UPDATE caja_sesiones SET cerrada_en = ?, conteo_final = ?, notas = ? WHERE id = ?',
  ).run(
    ahora(),
    Number(formData.get('conteo_final') || 0),
    String(formData.get('notas') || '').trim() || null,
    sesion.id,
  );
  refrescar();
}
