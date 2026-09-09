import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categorias (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  orden  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS productos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id INTEGER REFERENCES categorias(id),
  nombre       TEXT NOT NULL,
  descripcion  TEXT,
  precio       INTEGER NOT NULL,
  activo       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ingredientes (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS producto_ingredientes (
  producto_id    INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  ingrediente_id INTEGER NOT NULL REFERENCES ingredientes(id) ON DELETE CASCADE,
  removible      INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (producto_id, ingrediente_id)
);

CREATE TABLE IF NOT EXISTS mesas (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre     TEXT NOT NULL UNIQUE,
  zona       TEXT NOT NULL DEFAULT 'Salon',
  capacidad  INTEGER NOT NULL DEFAULT 4
);

CREATE TABLE IF NOT EXISTS domiciliarios (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre   TEXT NOT NULL UNIQUE,
  telefono TEXT,
  activo   INTEGER NOT NULL DEFAULT 1
);

/**
 * Quien entra al POS. El codigo es la llave que el dueño le entrega a cada
 * persona; 'activo' es el permiso del dia (se apaga al cerrar el turno).
 * Un domiciliario apunta ademas a su ficha en 'domiciliarios', que es a la
 * que se amarran los pedidos.
 */
CREATE TABLE IF NOT EXISTS usuarios (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre          TEXT NOT NULL,
  rol             TEXT NOT NULL,
  codigo          TEXT NOT NULL UNIQUE,
  telefono        TEXT,
  domiciliario_id INTEGER REFERENCES domiciliarios(id),
  activo          INTEGER NOT NULL DEFAULT 1,
  creado_en       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sesiones (
  token      TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creada_en  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS caja_sesiones (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  base         INTEGER NOT NULL DEFAULT 0,
  abierta_en   TEXT NOT NULL,
  cerrada_en   TEXT,
  conteo_final INTEGER,
  notas        TEXT
);

CREATE TABLE IF NOT EXISTS pedidos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo              TEXT NOT NULL,
  estado            TEXT NOT NULL DEFAULT 'abierto',
  mesa_id           INTEGER REFERENCES mesas(id),
  comensales        INTEGER,
  cliente_nombre    TEXT,
  cliente_telefono  TEXT,
  cliente_direccion TEXT,
  cliente_notas     TEXT,
  repartidor        TEXT,
  domiciliario_id   INTEGER REFERENCES domiciliarios(id),
  valor_domicilio   INTEGER NOT NULL DEFAULT 0,
  descuento         INTEGER NOT NULL DEFAULT 0,
  propina           INTEGER NOT NULL DEFAULT 0,
  caja_sesion_id    INTEGER REFERENCES caja_sesiones(id),
  usuario_id        INTEGER REFERENCES usuarios(id),
  creado_en         TEXT NOT NULL,
  cerrado_en        TEXT
);

CREATE TABLE IF NOT EXISTS pedido_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id   INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id),
  nombre      TEXT NOT NULL,
  precio_unit INTEGER NOT NULL,
  cantidad    INTEGER NOT NULL DEFAULT 1,
  notas       TEXT,
  estado      TEXT NOT NULL DEFAULT 'pendiente',
  creado_en   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pagos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id      INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  metodo         TEXT NOT NULL,
  monto          INTEGER NOT NULL,
  recibido       INTEGER,
  cambio         INTEGER,
  referencia     TEXT,
  caja_sesion_id INTEGER REFERENCES caja_sesiones(id),
  usuario_id     INTEGER REFERENCES usuarios(id),
  creado_en      TEXT NOT NULL
);

`;

/** Se corre despues de las migraciones, porque toca columnas agregadas. */
const INDICES = `
CREATE INDEX IF NOT EXISTS ix_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS ix_pedidos_domi   ON pedidos(domiciliario_id, estado);
CREATE INDEX IF NOT EXISTS ix_pedidos_mesa   ON pedidos(mesa_id, estado);
CREATE INDEX IF NOT EXISTS ix_items_pedido   ON pedido_items(pedido_id);
CREATE INDEX IF NOT EXISTS ix_pagos_pedido   ON pagos(pedido_id);
`;

/**
 * Migraciones para bases que ya existen. Cada una debe poder correr varias
 * veces sin romper nada.
 */
function migrar(db: DatabaseSync) {
  const columnas = (tabla: string) =>
    (db.prepare(`PRAGMA table_info(${tabla})`).all() as { name: string }[]).map(
      (c) => c.name,
    );

  if (!columnas('pedidos').includes('usuario_id')) {
    db.exec('ALTER TABLE pedidos ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)');
  }
  if (!columnas('pagos').includes('usuario_id')) {
    db.exec('ALTER TABLE pagos ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)');
  }

  if (!columnas('pedidos').includes('domiciliario_id')) {
    db.exec(
      'ALTER TABLE pedidos ADD COLUMN domiciliario_id INTEGER REFERENCES domiciliarios(id)',
    );
    // El campo viejo era texto libre: se convierte en domiciliarios reales.
    const nombres = db
      .prepare(
        `SELECT DISTINCT TRIM(repartidor) AS nombre FROM pedidos
          WHERE repartidor IS NOT NULL AND TRIM(repartidor) <> ''`,
      )
      .all() as { nombre: string }[];
    for (const { nombre } of nombres) {
      db.prepare('INSERT OR IGNORE INTO domiciliarios (nombre) VALUES (?)').run(nombre);
      db.prepare(
        `UPDATE pedidos
            SET domiciliario_id = (SELECT id FROM domiciliarios WHERE nombre = ?)
          WHERE TRIM(repartidor) = ?`,
      ).run(nombre, nombre);
    }
  }
}

declare global {
  var __posDb: DatabaseSync | undefined;
}

/**
 * Datos minimos para que el POS arranque usable. Solo corre si las tablas
 * estan vacias, asi que nunca pisa lo que ya cargaste.
 */
function semilla(db: DatabaseSync) {
  const hayMesas = db.prepare('SELECT COUNT(*) AS n FROM mesas').get() as {
    n: number;
  };
  if (hayMesas.n === 0) {
    const ins = db.prepare(
      'INSERT INTO mesas (nombre, zona, capacidad) VALUES (?, ?, ?)',
    );
    for (let i = 1; i <= 8; i++) ins.run(`Mesa ${i}`, 'Salon', i <= 6 ? 4 : 6);
    for (let i = 1; i <= 4; i++) ins.run(`Terraza ${i}`, 'Terraza', 4);
    ins.run('Barra 1', 'Barra', 2);
    ins.run('Barra 2', 'Barra', 2);
  }

  const hayProductos = db.prepare('SELECT COUNT(*) AS n FROM productos').get() as {
    n: number;
  };
  // La carta vive en carta.json; aqui solo se carga la primera vez.
  // Para actualizarla despues: editar el archivo y correr `npm run carta`.
  if (hayProductos.n === 0) {
    const carta = leerCarta();
    if (!carta) return;

    const insCat = db.prepare('INSERT INTO categorias (nombre, orden) VALUES (?, ?)');
    const insProd = db.prepare(
      `INSERT INTO productos (categoria_id, nombre, descripcion, precio)
       VALUES (?, ?, ?, ?)`,
    );
    const insIng = db.prepare('INSERT OR IGNORE INTO ingredientes (nombre) VALUES (?)');
    const selIng = db.prepare('SELECT id FROM ingredientes WHERE nombre = ?');
    const insPI = db.prepare(
      `INSERT OR IGNORE INTO producto_ingredientes (producto_id, ingrediente_id)
       VALUES (?, ?)`,
    );

    carta.categorias.forEach((cat, orden) => {
      const r = insCat.run(cat.nombre, orden);
      const catId = Number(r.lastInsertRowid);
      for (const p of cat.productos) {
        const rp = insProd.run(catId, p.nombre, p.descripcion ?? null, p.precio);
        const prodId = Number(rp.lastInsertRowid);
        for (const ing of p.ingredientes ?? []) {
          insIng.run(ing);
          const fila = selIng.get(ing) as { id: number };
          insPI.run(prodId, fila.id);
        }
      }
    });
  }
}

interface ProductoCarta {
  nombre: string;
  precio: number;
  descripcion?: string;
  ingredientes?: string[];
}

export interface Carta {
  negocio?: { nombre?: string; telefonos?: string[] };
  categorias: { nombre: string; productos: ProductoCarta[] }[];
}

export function leerCarta(): Carta | null {
  const ruta = path.join(process.cwd(), 'carta.json');
  if (!fs.existsSync(ruta)) return null;
  return JSON.parse(fs.readFileSync(ruta, 'utf8')) as Carta;
}

function abrir(): DatabaseSync {
  const dir = path.join(process.cwd(), 'datos');
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'pos.db'));
  db.exec(SCHEMA);
  migrar(db);
  db.exec(INDICES);
  semilla(db);
  return db;
}

function conexion(): DatabaseSync {
  return (globalThis.__posDb ??= abrir());
}

/**
 * Proxy perezoso: la base solo se abre en la primera consulta real, no al
 * importar el modulo. Durante `next build` varios workers evaluan estos
 * archivos en paralelo y abrirla ahi provoca "database is locked".
 */
export const db: DatabaseSync = new Proxy({} as DatabaseSync, {
  get(_destino, prop) {
    const real = conexion() as unknown as Record<PropertyKey, unknown>;
    const valor = real[prop];
    return typeof valor === 'function' ? valor.bind(real) : valor;
  },
});

export function ahora(): string {
  return new Date().toISOString();
}
