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

/** Copia plana de la fila: React no serializa lo que trae el driver. */
function plano<T>(fila: unknown): T {
  return { ...(fila as object) } as T;
}
function planos<T>(filas: unknown[]): T[] {
  return filas.map((f) => plano<T>(f));
}

/* ---------------------------------------------------------------- carta -- */

export async function listarCategorias(): Promise<Categoria[]> {
  return planos<Categoria>(
    await db.all('SELECT * FROM categorias ORDER BY orden, nombre'),
  );
}

export async function listarProductos(soloActivos = true): Promise<Producto[]> {
  const filtro = soloActivos ? 'WHERE p.activo = 1' : '';
  return planos<Producto>(
    await db.all(`SELECT p.*, c.nombre AS categoria
           FROM productos p
           LEFT JOIN categorias c ON c.id = p.categoria_id
           ${filtro}
          ORDER BY c.orden, c.nombre, p.nombre`),
  );
}

/** Mapa producto_id -> ingredientes removibles, para no hacer N consultas. */
export async function mapaIngredientes(): Promise<Record<number, string[]>> {
  const filas = await db.all(`SELECT pi.producto_id, i.nombre
         FROM producto_ingredientes pi
         JOIN ingredientes i ON i.id = pi.ingrediente_id
        WHERE pi.removible = 1
        ORDER BY i.nombre`) as unknown as { producto_id: number; nombre: string }[];
  const mapa: Record<number, string[]> = {};
  for (const f of filas) (mapa[f.producto_id] ??= []).push(f.nombre);
  return mapa;
}

/* ---------------------------------------------------------------- mesas -- */

export async function listarMesas(): Promise<Mesa[]> {
  return planos<Mesa>(await db.all('SELECT * FROM mesas ORDER BY zona, id'));
}

export async function listarMesasConEstado(): Promise<MesaConEstado[]> {
  return planos<MesaConEstado>(
    await db.all(`SELECT m.*,
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
          ORDER BY m.zona, m.id`),
  );
}

/* -------------------------------------------------------------- pedidos -- */

export async function obtenerPedido(id: number): Promise<PedidoCompleto | null> {
  const fila = await db.get(
    `SELECT p.*, m.nombre AS mesa_nombre, d.nombre AS domiciliario_nombre
         FROM pedidos p
         LEFT JOIN mesas m ON m.id = p.mesa_id
         LEFT JOIN domiciliarios d ON d.id = p.domiciliario_id
        WHERE p.id = ?`,
    id,
  );
  if (!fila) return null;

  const pedido = plano<Pedido>(fila);
  const items = planos<PedidoItem>(
    await db.all(`SELECT * FROM pedido_items
          WHERE pedido_id = ? AND estado <> 'anulado'
          ORDER BY id`, id),
  );
  const pagos = planos<Pago>(
    await db.all('SELECT * FROM pagos WHERE pedido_id = ? ORDER BY id', id),
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
export async function pedidoAbiertoDeMesa(mesaId: number): Promise<number | null> {
  const fila = await db.get(`SELECT id FROM pedidos
        WHERE mesa_id = ? AND estado NOT IN ('pagado', 'anulado')
        ORDER BY id DESC LIMIT 1`, mesaId) as { id: number } | undefined;
  return fila?.id ?? null;
}

export interface ResumenPedido extends Pedido {
  total: number;
  items: number;
  /** Lo ya abonado: sirve para saber si viene pagado por adelantado. */
  pagado: number;
}

export async function listarPedidos(tipo?: string, estados?: string[]): Promise<ResumenPedido[]> {
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
    await db.all(`SELECT p.*, m.nombre AS mesa_nombre, d.nombre AS domiciliario_nombre,
                COALESCE((SELECT SUM(i.precio_unit * i.cantidad)
                            FROM pedido_items i
                           WHERE i.pedido_id = p.id AND i.estado <> 'anulado'), 0)
                  - p.descuento + p.valor_domicilio + p.propina AS total,
                COALESCE((SELECT SUM(i.cantidad)
                            FROM pedido_items i
                           WHERE i.pedido_id = p.id AND i.estado <> 'anulado'), 0) AS items,
                COALESCE((SELECT SUM(g.monto) FROM pagos g
                           WHERE g.pedido_id = p.id), 0) AS pagado
           FROM pedidos p
           LEFT JOIN mesas m ON m.id = p.mesa_id
           LEFT JOIN domiciliarios d ON d.id = p.domiciliario_id
           ${where}
          ORDER BY p.id DESC`, ...args),
  );
}

/* -------------------------------------------------------- domiciliarios -- */

export async function listarDomiciliarios(soloActivos = true): Promise<Domiciliario[]> {
  return planos<Domiciliario>(
    await db.all(`SELECT * FROM domiciliarios
          ${soloActivos ? 'WHERE activo = 1' : ''}
          ORDER BY activo DESC, nombre`),
  );
}

export async function listarUsuarios(): Promise<Usuario[]> {
  return planos<Usuario>(
    await db.all('SELECT * FROM usuarios ORDER BY activo DESC, rol, nombre'),
  );
}

/** Pedidos vivos de un domiciliario: lo unico que ve en su pantalla. */
export async function pedidosDeDomiciliario(domiciliarioId: number): Promise<PedidoCompleto[]> {
  const filas = await db.all(`SELECT id FROM pedidos
        WHERE domiciliario_id = ? AND estado NOT IN ('pagado', 'anulado')
        ORDER BY id`, domiciliarioId) as unknown as { id: number }[];
  const pedidos = await Promise.all(filas.map((f) => obtenerPedido(f.id)));
  return pedidos.filter((p): p is PedidoCompleto => p !== null);
}

export interface EstadoDomiciliario extends Domiciliario {
  /** Codigo de acceso de su usuario, para que el dueño se lo pueda dictar. */
  codigo: string | null;
  usuario_id: number | null;
  /** Pedidos asignados que todavia no se han cobrado. */
  en_ruta: number;
  /** Plata que lleva encima sin liquidar (saldo de esos pedidos). */
  por_cobrar: number;
}

/** Quien es cada domiciliario y que lleva en la calle ahora mismo. */
export async function estadoDomiciliarios(): Promise<EstadoDomiciliario[]> {
  return planos<EstadoDomiciliario>(
    await db.all(`SELECT d.*,
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
                     AND p.estado NOT IN ('pagado', 'anulado')), 0) AS por_cobrar
           FROM domiciliarios d
          WHERE d.activo = 1
          ORDER BY d.nombre`),
  );
}

/* ------------------------------------------- control de lo que recaudan -- */

export interface CobroMetodo {
  metodo: string;
  monto: number;
  n: number;
}

export interface ControlDomiciliario extends EstadoDomiciliario {
  entregas_turno: number;
  cobrado_turno: number;
  /** Lo que se cobro por domicilios, para liquidarle su parte. */
  domicilios_turno: number;
  porMetodo: CobroMetodo[];
  efectivo_turno: number;
  /** Nequi, Bre-B, transferencia, tarjeta: entro al negocio directo. */
  digital_turno: number;
}

/**
 * Lo que cada domiciliario movio en un turno de caja, abierto por medio de
 * pago. El turno lo abre y lo cierra el dueño y puede pasarse de la
 * medianoche, asi que el corte no es por fecha sino por sesion de caja.
 */
export async function controlDomiciliarios(sesionId: number | null): Promise<ControlDomiciliario[]> {
  const cobros = await db.all(`SELECT p.domiciliario_id AS did, g.metodo,
              SUM(g.monto) AS monto, COUNT(*) AS n
         FROM pagos g
         JOIN pedidos p ON p.id = g.pedido_id
        WHERE p.domiciliario_id IS NOT NULL AND g.caja_sesion_id = ?
        GROUP BY p.domiciliario_id, g.metodo`, sesionId ?? -1) as unknown as {
    did: number;
    metodo: string;
    monto: number;
    n: number;
  }[];

  const entregas = await db.all(`SELECT domiciliario_id AS did, COUNT(*) AS n,
              COALESCE(SUM(valor_domicilio), 0) AS domicilios
         FROM pedidos
        WHERE domiciliario_id IS NOT NULL AND estado = 'pagado'
          AND caja_sesion_id = ?
        GROUP BY domiciliario_id`, sesionId ?? -1) as unknown as { did: number; n: number; domicilios: number }[];

  return (await estadoDomiciliarios()).map((d) => {
    const suyos = cobros.filter((c) => c.did === d.id);
    const entrega = entregas.find((e) => e.did === d.id);
    const efectivo = suyos
      .filter((c) => c.metodo === 'efectivo')
      .reduce((s, c) => s + c.monto, 0);
    const cobrado = suyos.reduce((s, c) => s + c.monto, 0);

    return {
      ...d,
      entregas_turno: entrega?.n ?? 0,
      domicilios_turno: entrega?.domicilios ?? 0,
      cobrado_turno: cobrado,
      efectivo_turno: efectivo,
      digital_turno: cobrado - efectivo,
      porMetodo: suyos
        .map(({ metodo, monto, n }) => ({ metodo, monto, n }))
        .sort((a, b) => b.monto - a.monto),
    };
  });
}

export interface EntregaDelTurno {
  id: number;
  domiciliario_id: number;
  cliente_nombre: string | null;
  cliente_direccion: string | null;
  cerrado_en: string;
  total: number;
  metodos: string | null;
}

/** Una linea por entrega cobrada, para poder revisar peso por peso. */
export async function entregasDelTurno(sesionId: number | null): Promise<EntregaDelTurno[]> {
  return planos<EntregaDelTurno>(
    await db.all(`SELECT p.id, p.domiciliario_id, p.cliente_nombre, p.cliente_direccion,
                p.cerrado_en,
                COALESCE((SELECT SUM(g.monto) FROM pagos g
                           WHERE g.pedido_id = p.id), 0) AS total,
                (SELECT string_agg(DISTINCT g.metodo, ',') FROM pagos g
                  WHERE g.pedido_id = p.id) AS metodos
           FROM pedidos p
          WHERE p.domiciliario_id IS NOT NULL
            AND p.estado = 'pagado'
            AND p.caja_sesion_id = ?
          ORDER BY p.cerrado_en DESC`, sesionId ?? -1),
  );
}

/* ------------------------------------------------------------ historial -- */

export interface TurnoResumen extends CajaSesion {
  ventas: number;
  pedidos: number;
}

/** Los turnos de caja, del mas reciente al mas viejo. */
export async function listarTurnos(): Promise<TurnoResumen[]> {
  return planos<TurnoResumen>(
    await db.all(`SELECT c.*,
                COALESCE((SELECT SUM(g.monto) FROM pagos g
                           WHERE g.caja_sesion_id = c.id), 0) AS ventas,
                (SELECT COUNT(*) FROM pedidos p
                  WHERE p.caja_sesion_id = c.id AND p.estado = 'pagado') AS pedidos
           FROM caja_sesiones c
          ORDER BY c.id DESC`),
  );
}

export interface PedidoHistorial {
  id: number;
  tipo: string;
  estado: string;
  mesa_nombre: string | null;
  cliente_nombre: string | null;
  domiciliario_nombre: string | null;
  creado_en: string;
  cerrado_en: string | null;
  total: number;
  items: number;
  metodos: string | null;
  cobrado_por: string | null;
}

/**
 * Los pedidos que ya se cerraron, cobrados y anulados. `sesionId` null trae
 * todo el historial; con un turno, solo el de ese turno.
 */
export async function historialPedidos(sesionId: number | null, limite = 500): Promise<PedidoHistorial[]> {
  const filtro = sesionId === null ? '' : 'AND p.caja_sesion_id = ?';
  const args = sesionId === null ? [limite] : [sesionId, limite];

  return planos<PedidoHistorial>(
    await db.all(
      `SELECT p.id, p.tipo, p.estado, p.creado_en, p.cerrado_en,
                m.nombre AS mesa_nombre, p.cliente_nombre,
                d.nombre AS domiciliario_nombre,
                COALESCE((SELECT SUM(i.precio_unit * i.cantidad)
                            FROM pedido_items i
                           WHERE i.pedido_id = p.id AND i.estado <> 'anulado'), 0)
                  - p.descuento + p.valor_domicilio + p.propina AS total,
                COALESCE((SELECT SUM(i.cantidad)
                            FROM pedido_items i
                           WHERE i.pedido_id = p.id AND i.estado <> 'anulado'), 0) AS items,
                (SELECT string_agg(DISTINCT g.metodo, ',') FROM pagos g
                  WHERE g.pedido_id = p.id) AS metodos,
                (SELECT u.nombre FROM pagos g
                   LEFT JOIN usuarios u ON u.id = g.usuario_id
                  WHERE g.pedido_id = p.id
                  ORDER BY g.id DESC LIMIT 1) AS cobrado_por
           FROM pedidos p
           LEFT JOIN mesas m ON m.id = p.mesa_id
           LEFT JOIN domiciliarios d ON d.id = p.domiciliario_id
          WHERE p.estado IN ('pagado', 'anulado') ${filtro}
          ORDER BY COALESCE(p.cerrado_en, p.creado_en) DESC
          LIMIT ?`, ...args),
  );
}

export interface ProductoVendido {
  nombre: string;
  cantidad: number;
  monto: number;
}

/** Que se vendio y cuanto, para saber que se mueve y que no. */
export async function productosVendidos(sesionId: number | null): Promise<ProductoVendido[]> {
  const filtro = sesionId === null ? '' : 'AND p.caja_sesion_id = ?';
  const args = sesionId === null ? [] : [sesionId];

  return planos<ProductoVendido>(
    await db.all(`SELECT i.nombre,
                SUM(i.cantidad) AS cantidad,
                SUM(i.cantidad * i.precio_unit) AS monto
           FROM pedido_items i
           JOIN pedidos p ON p.id = i.pedido_id
          WHERE p.estado = 'pagado' AND i.estado <> 'anulado' ${filtro}
          GROUP BY i.nombre
          ORDER BY cantidad DESC, monto DESC`, ...args),
  );
}

export async function cobrosPorMetodo(sesionId: number | null): Promise<CobroMetodo[]> {
  const filtro = sesionId === null ? '' : 'WHERE caja_sesion_id = ?';
  const args = sesionId === null ? [] : [sesionId];

  return planos<CobroMetodo>(
    await db.all(`SELECT metodo, SUM(monto) AS monto, COUNT(*) AS n
           FROM pagos ${filtro}
          GROUP BY metodo
          ORDER BY monto DESC`, ...args),
  );
}

/* ----------------------------------------------------------------- caja -- */

export async function cajaAbierta(): Promise<CajaSesion | null> {
  const fila = await db.get('SELECT * FROM caja_sesiones WHERE cerrada_en IS NULL ORDER BY id DESC LIMIT 1');
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

export async function resumenCaja(sesion: CajaSesion): Promise<ResumenCaja> {
  const porMetodo = planos<{ metodo: string; monto: number; n: number }>(
    await db.all(`SELECT metodo, SUM(monto) AS monto, COUNT(*) AS n
           FROM pagos WHERE caja_sesion_id = ?
          GROUP BY metodo ORDER BY metodo`, sesion.id),
  );

  const ventas = porMetodo.reduce((s, m) => s + m.monto, 0);
  const efectivo = porMetodo.find((m) => m.metodo === 'efectivo')?.monto ?? 0;

  const agg = await db.get(`SELECT COUNT(*) AS n,
              COALESCE(SUM(propina), 0)         AS propinas,
              COALESCE(SUM(valor_domicilio), 0) AS domicilios
         FROM pedidos
        WHERE caja_sesion_id = ? AND estado = 'pagado'`, sesion.id) as unknown as { n: number; propinas: number; domicilios: number };

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
