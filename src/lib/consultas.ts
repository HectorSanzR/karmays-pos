import { db } from './db';
import type {
  Categoria,
  CajaSesion,
  Cuenta,
  Domiciliario,
  Mesa,
  MesaConEstado,
  Pago,
  Pedido,
  PedidoCompleto,
  PedidoItem,
  Producto,
  Usuario,
} from './tipos';

/** node:sqlite devuelve objetos sin prototipo; React no los puede serializar. */
function plano<T>(fila: unknown): T {
  return { ...(fila as object) } as T;
}
function planos<T>(filas: unknown[]): T[] {
  return filas.map((f) => plano<T>(f));
}

/* ---------------------------------------------------------------- carta -- */

export function listarCategorias(): Categoria[] {
  return planos<Categoria>(
    db.prepare('SELECT * FROM categorias ORDER BY orden, nombre').all(),
  );
}

export function listarProductos(soloActivos = true): Producto[] {
  const filtro = soloActivos ? 'WHERE p.activo = 1' : '';
  return planos<Producto>(
    db
      .prepare(
        `SELECT p.*, c.nombre AS categoria
           FROM productos p
           LEFT JOIN categorias c ON c.id = p.categoria_id
           ${filtro}
          ORDER BY c.orden, c.nombre, p.nombre`,
      )
      .all(),
  );
}

/** Mapa producto_id -> ingredientes removibles, para no hacer N consultas. */
export function mapaIngredientes(): Record<number, string[]> {
  const filas = db
    .prepare(
      `SELECT pi.producto_id, i.nombre
         FROM producto_ingredientes pi
         JOIN ingredientes i ON i.id = pi.ingrediente_id
        WHERE pi.removible = 1
        ORDER BY i.nombre`,
    )
    .all() as unknown as { producto_id: number; nombre: string }[];
  const mapa: Record<number, string[]> = {};
  for (const f of filas) (mapa[f.producto_id] ??= []).push(f.nombre);
  return mapa;
}

/* ---------------------------------------------------------------- mesas -- */

export function listarMesas(): Mesa[] {
  return planos<Mesa>(db.prepare('SELECT * FROM mesas ORDER BY zona, id').all());
}

export function listarMesasConEstado(): MesaConEstado[] {
  return planos<MesaConEstado>(
    db
      .prepare(
        `SELECT m.*,
                p.id        AS pedido_id,
                p.creado_en AS abierta_desde,
                COALESCE((SELECT SUM(i.precio_unit * i.cantidad)
                            FROM pedido_items i
                           WHERE i.pedido_id = p.id AND i.estado <> 'anulado'), 0) AS total,
                COALESCE((SELECT SUM(i.cantidad)
                            FROM pedido_items i
                           WHERE i.pedido_id = p.id AND i.estado <> 'anulado'), 0) AS items
           FROM mesas m
           LEFT JOIN pedidos p
                  ON p.mesa_id = m.id
                 AND p.estado NOT IN ('pagado', 'anulado')
          ORDER BY m.zona, m.id`,
      )
      .all(),
  );
}

/* -------------------------------------------------------------- pedidos -- */

export function obtenerPedido(id: number): PedidoCompleto | null {
  const fila = db
    .prepare(
      `SELECT p.*, m.nombre AS mesa_nombre, d.nombre AS domiciliario_nombre
         FROM pedidos p
         LEFT JOIN mesas m ON m.id = p.mesa_id
         LEFT JOIN domiciliarios d ON d.id = p.domiciliario_id
        WHERE p.id = ?`,
    )
    .get(id);
  if (!fila) return null;

  const pedido = plano<Pedido>(fila);
  const items = planos<PedidoItem>(
    db
      .prepare(
        `SELECT * FROM pedido_items
          WHERE pedido_id = ? AND estado <> 'anulado'
          ORDER BY id`,
      )
      .all(id),
  );
  const pagos = planos<Pago>(
    db.prepare('SELECT * FROM pagos WHERE pedido_id = ? ORDER BY id').all(id),
  );

  return { ...pedido, items, pagos, cuenta: calcularCuenta(pedido, items, pagos) };
}

export function calcularCuenta(
  pedido: Pedido,
  items: PedidoItem[],
  pagos: Pago[],
): Cuenta {
  const subtotal = items.reduce((s, i) => s + i.precio_unit * i.cantidad, 0);
  const descuento = pedido.descuento ?? 0;
  const domicilio = pedido.valor_domicilio ?? 0;
  const propina = pedido.propina ?? 0;
  const total = Math.max(0, subtotal - descuento + domicilio + propina);
  const pagado = pagos.reduce((s, p) => s + p.monto, 0);
  return { subtotal, descuento, domicilio, propina, total, pagado, saldo: total - pagado };
}

/** Pedido abierto de una mesa, o null si esta libre. */
export function pedidoAbiertoDeMesa(mesaId: number): number | null {
  const fila = db
    .prepare(
      `SELECT id FROM pedidos
        WHERE mesa_id = ? AND estado NOT IN ('pagado', 'anulado')
        ORDER BY id DESC LIMIT 1`,
    )
    .get(mesaId) as { id: number } | undefined;
  return fila?.id ?? null;
}

export interface ResumenPedido extends Pedido {
  total: number;
  items: number;
}

export function listarPedidos(tipo?: string, estados?: string[]): ResumenPedido[] {
  const cond: string[] = [];
  const args: (string | number)[] = [];
  if (tipo) {
    cond.push('p.tipo = ?');
    args.push(tipo);
  }
  if (estados?.length) {
    cond.push(`p.estado IN (${estados.map(() => '?').join(',')})`);
    args.push(...estados);
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  return planos<ResumenPedido>(
    db
      .prepare(
        `SELECT p.*, m.nombre AS mesa_nombre, d.nombre AS domiciliario_nombre,
                COALESCE((SELECT SUM(i.precio_unit * i.cantidad)
                            FROM pedido_items i
                           WHERE i.pedido_id = p.id AND i.estado <> 'anulado'), 0)
                  - p.descuento + p.valor_domicilio + p.propina AS total,
                COALESCE((SELECT SUM(i.cantidad)
                            FROM pedido_items i
                           WHERE i.pedido_id = p.id AND i.estado <> 'anulado'), 0) AS items
           FROM pedidos p
           LEFT JOIN mesas m ON m.id = p.mesa_id
           LEFT JOIN domiciliarios d ON d.id = p.domiciliario_id
           ${where}
          ORDER BY p.id DESC`,
      )
      .all(...args),
  );
}

/* -------------------------------------------------------- domiciliarios -- */

export function listarDomiciliarios(soloActivos = true): Domiciliario[] {
  return planos<Domiciliario>(
    db
      .prepare(
        `SELECT * FROM domiciliarios
          ${soloActivos ? 'WHERE activo = 1' : ''}
          ORDER BY activo DESC, nombre`,
      )
      .all(),
  );
}

export function listarUsuarios(): Usuario[] {
  return planos<Usuario>(
    db
      .prepare('SELECT * FROM usuarios ORDER BY activo DESC, rol, nombre')
      .all(),
  );
}

/** Pedidos vivos de un domiciliario: lo unico que ve en su pantalla. */
export function pedidosDeDomiciliario(domiciliarioId: number): PedidoCompleto[] {
  const filas = db
    .prepare(
      `SELECT id FROM pedidos
        WHERE domiciliario_id = ? AND estado NOT IN ('pagado', 'anulado')
        ORDER BY id`,
    )
    .all(domiciliarioId) as unknown as { id: number }[];
  return filas
    .map((f) => obtenerPedido(f.id))
    .filter((p): p is PedidoCompleto => p !== null);
}

export interface EstadoDomiciliario extends Domiciliario {
  /** Codigo de acceso de su usuario, para que el dueño se lo pueda dictar. */
  codigo: string | null;
  usuario_id: number | null;
  /** Pedidos asignados que todavia no se han cobrado. */
  en_ruta: number;
  /** Plata que lleva encima sin liquidar (saldo de esos pedidos). */
  por_cobrar: number;
  /** Efectivo de sus pedidos ya cobrado en el turno actual. */
  efectivo_turno: number;
  entregados: number;
}

/** Estado de cada domiciliario en el turno abierto (o cero si no hay caja). */
export function estadoDomiciliarios(): EstadoDomiciliario[] {
  const sesionId = cajaAbierta()?.id ?? -1;
  return planos<EstadoDomiciliario>(
    db
      .prepare(
        `SELECT d.*,
                (SELECT u.codigo FROM usuarios u
                  WHERE u.domiciliario_id = d.id ORDER BY u.id DESC LIMIT 1) AS codigo,
                (SELECT u.id FROM usuarios u
                  WHERE u.domiciliario_id = d.id ORDER BY u.id DESC LIMIT 1) AS usuario_id,
                (SELECT COUNT(*) FROM pedidos p
                  WHERE p.domiciliario_id = d.id
                    AND p.estado NOT IN ('pagado', 'anulado')) AS en_ruta,
                COALESCE((
                  SELECT SUM(
                    COALESCE((SELECT SUM(i.precio_unit * i.cantidad)
                                FROM pedido_items i
                               WHERE i.pedido_id = p.id AND i.estado <> 'anulado'), 0)
                    - p.descuento + p.valor_domicilio + p.propina
                    - COALESCE((SELECT SUM(g.monto) FROM pagos g
                                 WHERE g.pedido_id = p.id), 0))
                    FROM pedidos p
                   WHERE p.domiciliario_id = d.id
                     AND p.estado NOT IN ('pagado', 'anulado')), 0) AS por_cobrar,
                COALESCE((
                  SELECT SUM(g.monto) FROM pagos g
                    JOIN pedidos p ON p.id = g.pedido_id
                   WHERE p.domiciliario_id = d.id
                     AND g.metodo = 'efectivo'
                     AND g.caja_sesion_id = ?), 0) AS efectivo_turno,
                (SELECT COUNT(*) FROM pedidos p
                  WHERE p.domiciliario_id = d.id
                    AND p.estado = 'pagado'
                    AND p.caja_sesion_id = ?) AS entregados
           FROM domiciliarios d
          WHERE d.activo = 1
          ORDER BY d.nombre`,
      )
      .all(sesionId, sesionId),
  );
}

/* ------------------------------------------- control de lo que recaudan -- */

export interface CobroMetodo {
  metodo: string;
  monto: number;
  n: number;
}

export interface ControlDomiciliario extends EstadoDomiciliario {
  entregas_hoy: number;
  cobrado_hoy: number;
  /** Lo que se cobro por domicilios, para liquidarle su parte. */
  domicilios_hoy: number;
  porMetodo: CobroMetodo[];
  efectivo_hoy: number;
  /** Nequi, Bre-B, transferencia, tarjeta: entro al negocio directo. */
  digital_hoy: number;
}

/**
 * Lo que cada domiciliario movio desde `desde`, abierto por medio de pago.
 * Es la foto que hace falta para cuadrar con cada uno al final del dia.
 */
export function controlDomiciliarios(desde: string): ControlDomiciliario[] {
  const cobros = db
    .prepare(
      `SELECT p.domiciliario_id AS did, g.metodo,
              SUM(g.monto) AS monto, COUNT(*) AS n
         FROM pagos g
         JOIN pedidos p ON p.id = g.pedido_id
        WHERE p.domiciliario_id IS NOT NULL AND g.creado_en >= ?
        GROUP BY p.domiciliario_id, g.metodo`,
    )
    .all(desde) as unknown as { did: number; metodo: string; monto: number; n: number }[];

  const entregas = db
    .prepare(
      `SELECT domiciliario_id AS did, COUNT(*) AS n,
              COALESCE(SUM(valor_domicilio), 0) AS domicilios
         FROM pedidos
        WHERE domiciliario_id IS NOT NULL AND estado = 'pagado' AND cerrado_en >= ?
        GROUP BY domiciliario_id`,
    )
    .all(desde) as unknown as { did: number; n: number; domicilios: number }[];

  return estadoDomiciliarios().map((d) => {
    const suyos = cobros.filter((c) => c.did === d.id);
    const entrega = entregas.find((e) => e.did === d.id);
    const efectivo = suyos
      .filter((c) => c.metodo === 'efectivo')
      .reduce((s, c) => s + c.monto, 0);
    const cobrado = suyos.reduce((s, c) => s + c.monto, 0);

    return {
      ...d,
      entregas_hoy: entrega?.n ?? 0,
      domicilios_hoy: entrega?.domicilios ?? 0,
      cobrado_hoy: cobrado,
      efectivo_hoy: efectivo,
      digital_hoy: cobrado - efectivo,
      porMetodo: suyos
        .map(({ metodo, monto, n }) => ({ metodo, monto, n }))
        .sort((a, b) => b.monto - a.monto),
    };
  });
}

export interface EntregaDelDia {
  id: number;
  domiciliario_id: number;
  cliente_nombre: string | null;
  cliente_direccion: string | null;
  cerrado_en: string;
  total: number;
  metodos: string | null;
}

/** Una linea por entrega cobrada, para poder revisar peso por peso. */
export function entregasDelDia(desde: string): EntregaDelDia[] {
  return planos<EntregaDelDia>(
    db
      .prepare(
        `SELECT p.id, p.domiciliario_id, p.cliente_nombre, p.cliente_direccion,
                p.cerrado_en,
                COALESCE((SELECT SUM(g.monto) FROM pagos g
                           WHERE g.pedido_id = p.id), 0) AS total,
                (SELECT GROUP_CONCAT(DISTINCT g.metodo) FROM pagos g
                  WHERE g.pedido_id = p.id) AS metodos
           FROM pedidos p
          WHERE p.domiciliario_id IS NOT NULL
            AND p.estado = 'pagado'
            AND p.cerrado_en >= ?
          ORDER BY p.cerrado_en DESC`,
      )
      .all(desde),
  );
}

/* ----------------------------------------------------------------- caja -- */

export function cajaAbierta(): CajaSesion | null {
  const fila = db
    .prepare(
      'SELECT * FROM caja_sesiones WHERE cerrada_en IS NULL ORDER BY id DESC LIMIT 1',
    )
    .get();
  return fila ? plano<CajaSesion>(fila) : null;
}

export interface ResumenCaja {
  sesion: CajaSesion;
  porMetodo: { metodo: string; monto: number; n: number }[];
  ventas: number;
  efectivo: number;
  propinas: number;
  domicilios: number;
  pedidosPagados: number;
  esperadoEnCaja: number;
}

export function resumenCaja(sesion: CajaSesion): ResumenCaja {
  const porMetodo = planos<{ metodo: string; monto: number; n: number }>(
    db
      .prepare(
        `SELECT metodo, SUM(monto) AS monto, COUNT(*) AS n
           FROM pagos WHERE caja_sesion_id = ?
          GROUP BY metodo ORDER BY metodo`,
      )
      .all(sesion.id),
  );

  const ventas = porMetodo.reduce((s, m) => s + m.monto, 0);
  const efectivo = porMetodo.find((m) => m.metodo === 'efectivo')?.monto ?? 0;

  const agg = db
    .prepare(
      `SELECT COUNT(*) AS n,
              COALESCE(SUM(propina), 0)         AS propinas,
              COALESCE(SUM(valor_domicilio), 0) AS domicilios
         FROM pedidos
        WHERE caja_sesion_id = ? AND estado = 'pagado'`,
    )
    .get(sesion.id) as unknown as { n: number; propinas: number; domicilios: number };

  return {
    sesion,
    porMetodo,
    ventas,
    efectivo,
    propinas: agg.propinas,
    domicilios: agg.domicilios,
    pedidosPagados: agg.n,
    esperadoEnCaja: sesion.base + efectivo,
  };
}
