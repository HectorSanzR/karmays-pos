/**
 * Sube a Supabase lo que hoy vive en datos/pos.db: la carta, las mesas, la
 * gente con sus codigos, los turnos de caja y todos los pedidos con sus pagos.
 *
 *   npm run db:migrar
 *
 * Solo corre si las tablas de Postgres estan vacias, para no duplicar nada si
 * se ejecuta dos veces. Las sesiones abiertas no se copian: cada quien vuelve
 * a marcar su codigo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL en .env.local');
  process.exit(1);
}

const rutaSqlite = path.join(process.cwd(), 'datos', 'pos.db');
if (!fs.existsSync(rutaSqlite)) {
  console.error('No encuentro datos/pos.db: no hay nada que migrar.');
  process.exit(1);
}

// El orden importa: cada tabla necesita que ya existan las que referencia.
const TABLAS = [
  'categorias',
  'productos',
  'ingredientes',
  'producto_ingredientes',
  'mesas',
  'domiciliarios',
  'usuarios',
  'caja_sesiones',
  'pedidos',
  'pedido_items',
  'pagos',
];

const vieja = new DatabaseSync(rutaSqlite, { readOnly: true });
const nueva = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await nueva.connect();

/** Columnas que existen en las dos bases, para no chocar con diferencias. */
function columnasComunes(tabla, filaEjemplo) {
  return nueva
    .query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1`,
      [tabla],
    )
    .then(({ rows }) => {
      const enPostgres = new Set(rows.map((r) => r.column_name));
      return Object.keys(filaEjemplo).filter((c) => enPostgres.has(c));
    });
}

try {
  await nueva.query('BEGIN');

  for (const tabla of TABLAS) {
    const filas = vieja.prepare(`SELECT * FROM ${tabla}`).all();
    if (filas.length === 0) {
      console.log(`${tabla}: vacia, nada que copiar`);
      continue;
    }

    const { rows: yaHay } = await nueva.query(`SELECT COUNT(*)::int AS n FROM ${tabla}`);
    if (yaHay[0].n > 0) {
      console.log(`${tabla}: ya tiene ${yaHay[0].n} filas, se salta`);
      continue;
    }

    const columnas = await columnasComunes(tabla, filas[0]);
    const lista = columnas.map((c) => `"${c}"`).join(', ');
    const huecos = columnas.map((_, i) => `$${i + 1}`).join(', ');
    // OVERRIDING SYSTEM VALUE deja conservar los ids originales, para que los
    // pedidos sigan apuntando a lo mismo.
    const sql = `INSERT INTO ${tabla} (${lista}) OVERRIDING SYSTEM VALUE VALUES (${huecos})`;

    for (const fila of filas) {
      await nueva.query(
        sql,
        columnas.map((c) => (fila[c] === undefined ? null : fila[c])),
      );
    }

    // Se adelanta el contador de ids para que el proximo INSERT no choque.
    if (columnas.includes('id')) {
      await nueva.query(
        `SELECT setval(pg_get_serial_sequence('${tabla}', 'id'),
                       COALESCE((SELECT MAX(id) FROM ${tabla}), 1))`,
      );
    }

    console.log(`${tabla}: ${filas.length} filas copiadas`);
  }

  await nueva.query('COMMIT');
  console.log('\nListo. Revisa el POS apuntando a Supabase antes de dejar de usar el local.');
} catch (e) {
  await nueva.query('ROLLBACK');
  console.error('Fallo la migracion, no se guardo nada:', e.message);
  process.exitCode = 1;
} finally {
  await nueva.end();
}
