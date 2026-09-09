/**
 * Crea las tablas en la base Postgres. Se corre una vez al montar el proyecto, y de
 * nuevo sin miedo cada vez que cambie sql/esquema.sql: todo es IF NOT EXISTS.
 *
 *   npm run db:esquema
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    'Falta DATABASE_URL. Ponla en .env.local con la cadena de conexion de\n' +
      'tu base Postgres (Neon, Supabase, la que sea).',
  );
  process.exit(1);
}

const sql = fs.readFileSync(path.join(process.cwd(), 'sql', 'esquema.sql'), 'utf8');

const cliente = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await cliente.connect();
try {
  await cliente.query(sql);
  const { rows } = await cliente.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`,
  );
  console.log('Esquema listo. Tablas:', rows.map((r) => r.table_name).join(', '));
} finally {
  await cliente.end();
}
