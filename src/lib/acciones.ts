'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db, ahora } from './db';
import { cajaAbierta, obtenerPedido, pedidoAbiertoDeMesa } from './consultas';
import {
  COOKIE,
  PERMISOS,
  generarCodigo,
  hayUsuarios,
  usuarioActual,
} from './sesion';
import type { MetodoPago, Rol, TipoPedido } from './tipos';

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
      `INSERT INTO pedidos (tipo, estado, mesa_id, comensales, usuario_id, creado_en)
       VALUES ('mesa', 'abierto', ?, ?, ?, ?)`,
    )
    .run(mesaId, comensales, (await usuarioActual())?.id ?? null, ahora());
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
          cliente_notas, valor_domicilio, usuario_id, creado_en)
       VALUES (?, 'abierto', ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      tipo,
      String(formData.get('cliente_nombre') || '').trim() || null,
      String(formData.get('cliente_telefono') || '').trim() || null,
      String(formData.get('cliente_direccion') || '').trim() || null,
      String(formData.get('cliente_notas') || '').trim() || null,
      Number(formData.get('valor_domicilio') || 0),
      (await usuarioActual())?.id ?? null,
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
    `UPDATE pedidos SET estado = 'anulado', cerrado_en = ?, caja_sesion_id = ?
      WHERE id = ?`,
  ).run(ahora(), cajaAbierta()?.id ?? null, pedidoId);
  refrescar();
  redirect('/');
}

/* ---------------------------------------------------------------- acceso -- */

export interface ResultadoEntrar {
  ok: boolean;
  error?: string;
}

export async function entrar(formData: FormData): Promise<ResultadoEntrar> {
  const codigo = String(formData.get('codigo') || '').trim();
  if (!/^\d{4}$/.test(codigo)) return { ok: false, error: 'El codigo son 4 numeros' };

  const usuario = db
    .prepare('SELECT id, rol FROM usuarios WHERE codigo = ? AND activo = 1')
    .get(codigo) as unknown as { id: number; rol: Rol } | undefined;

  if (!usuario) {
    // Mismo mensaje si el codigo no existe o si esta deshabilitado: no hay
    // por que ayudar a adivinar codigos ajenos.
    return { ok: false, error: 'Codigo incorrecto o sin acceso hoy' };
  }

  const token = randomUUID();
  db.prepare('INSERT INTO sesiones (token, usuario_id, creada_en) VALUES (?, ?, ?)').run(
    token,
    usuario.id,
    ahora(),
  );

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 18,
  });

  redirect(PERMISOS[usuario.rol].inicio);
}

export async function salir() {
  const galletas = await cookies();
  const token = galletas.get(COOKIE)?.value;
  if (token) db.prepare('DELETE FROM sesiones WHERE token = ?').run(token);
  galletas.delete(COOKIE);
  redirect('/entrar');
}

/** Solo funciona mientras no exista ningun usuario: el arranque del sistema. */
export async function crearAdminInicial(formData: FormData): Promise<ResultadoEntrar> {
  if (hayUsuarios()) return { ok: false, error: 'El sistema ya esta configurado' };

  const nombre = String(formData.get('nombre') || '').trim();
  const codigo = String(formData.get('codigo') || '').trim();
  if (!nombre) return { ok: false, error: 'Escribe tu nombre' };
  if (!/^\d{4}$/.test(codigo)) return { ok: false, error: 'El codigo son 4 numeros' };

  db.prepare(
    `INSERT INTO usuarios (nombre, rol, codigo, creado_en)
     VALUES (?, 'admin', ?, ?)`,
  ).run(nombre, codigo, ahora());

  refrescar();
  return { ok: true };
}

/* -------------------------------------------------------------- usuarios -- */

export async function crearUsuario(formData: FormData) {
  const nombre = String(formData.get('nombre') || '').trim();
  const rol = String(formData.get('rol') || '') as Rol;
  if (!nombre || !PERMISOS[rol]) return;

  const telefono = String(formData.get('telefono') || '').trim() || null;
  const codigo = generarCodigo();

  // Un domiciliario necesita ademas su ficha, que es a la que se le amarran
  // los pedidos.
  let domiciliarioId: number | null = null;
  if (rol === 'domiciliario') {
    db.prepare(
      `INSERT INTO domiciliarios (nombre, telefono) VALUES (?, ?)
       ON CONFLICT(nombre) DO UPDATE SET activo = 1, telefono = excluded.telefono`,
    ).run(nombre, telefono);
    const fila = db
      .prepare('SELECT id FROM domiciliarios WHERE nombre = ?')
      .get(nombre) as unknown as { id: number };
    domiciliarioId = fila.id;
  }

  db.prepare(
    `INSERT INTO usuarios (nombre, rol, codigo, telefono, domiciliario_id, creado_en)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(nombre, rol, codigo, telefono, domiciliarioId, ahora());

  refrescar();
}

/** El permiso del dia: al apagarlo, la sesion abierta deja de servir. */
export async function activarUsuario(id: number, activo: boolean) {
  db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(activo ? 1 : 0, id);
  if (!activo) db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(id);

  const fila = db
    .prepare('SELECT domiciliario_id FROM usuarios WHERE id = ?')
    .get(id) as unknown as { domiciliario_id: number | null } | undefined;
  if (fila?.domiciliario_id) {
    db.prepare('UPDATE domiciliarios SET activo = ? WHERE id = ?').run(
      activo ? 1 : 0,
      fila.domiciliario_id,
    );
  }
  refrescar();
}

/** Si a alguien se le fue el codigo de las manos, se cambia y se le pasa otro. */
export async function regenerarCodigo(id: number) {
  db.prepare('UPDATE usuarios SET codigo = ? WHERE id = ?').run(generarCodigo(), id);
  db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(id);
  refrescar();
}

/* -------------------------------------------------------- domiciliarios -- */

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
       (pedido_id, metodo, monto, recibido, cambio, referencia,
        caja_sesion_id, usuario_id, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    pedidoId,
    metodo,
    cobro,
    recibido ? Math.round(recibido) : null,
    cambio,
    referencia?.trim() || null,
    sesion.id,
    (await usuarioActual())?.id ?? null,
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

/**
 * Cobro desde la calle: el domiciliario marca por donde le pagaron y el
 * pedido queda entregado y saldado de una vez. Solo puede tocar los suyos.
 */
export async function cobrarEnRuta(
  pedidoId: number,
  metodo: MetodoPago,
): Promise<ResultadoPago> {
  const usuario = await usuarioActual();
  if (!usuario?.domiciliario_id) return { ok: false, error: 'Sin permiso' };

  const pedido = obtenerPedido(pedidoId);
  if (!pedido) return { ok: false, error: 'Pedido no encontrado' };
  if (pedido.domiciliario_id !== usuario.domiciliario_id) {
    return { ok: false, error: 'Ese pedido no es tuyo' };
  }
  if (pedido.cuenta.saldo <= 0) return { ok: false, error: 'Ya estaba saldado' };

  const r = await registrarPago(pedidoId, metodo, pedido.cuenta.saldo);
  if (!r.ok) return r;

  db.prepare(`UPDATE pedidos SET estado = 'pagado' WHERE id = ?`).run(pedidoId);
  refrescar();
  return r;
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
