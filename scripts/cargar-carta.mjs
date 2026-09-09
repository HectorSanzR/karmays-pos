/**
 * Sincroniza carta.json con la base del POS.
 *   npm run carta
 *
 * Es idempotente y no destructivo: actualiza precios, agrega lo nuevo y
 * desactiva (activo = 0) lo que ya no este en el archivo, para que los
 * pedidos viejos sigan mostrando bien sus productos.
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL en .env.local');
  process.exit(1);
}

const rutaCarta = path.join(process.cwd(), 'carta.json');
if (!fs.existsSync(rutaCarta)) {
  console.error('No encuentro carta.json en', process.cwd());
  process.exit(1);
}

const carta = JSON.parse(fs.readFileSync(rutaCarta, 'utf8'));
const db = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await db.connect();

const uno = async (sql, args = []) => (await db.query(sql, args)).rows[0];

const vistos = new Set();
let nuevos = 0;
let actualizados = 0;

try {
  await db.query('BEGIN');

  for (const [orden, cat] of carta.categorias.entries()) {
    let fila = await uno('SELECT id FROM categorias WHERE nombre = $1', [cat.nombre]);
    if (!fila) {
      fila = await uno(
        'INSERT INTO categorias (nombre, orden) VALUES ($1, $2) RETURNING id',
        [cat.nombre, orden],
      );
    } else {
      await db.query('UPDATE categorias SET orden = $1 WHERE id = $2', [orden, fila.id]);
    }
    const catId = fila.id;

    for (const p of cat.productos) {
      const existente = await uno(
        'SELECT id FROM productos WHERE categoria_id = $1 AND nombre = $2',
        [catId, p.nombre],
      );

      let prodId;
      if (existente) {
        await db.query(
          'UPDATE productos SET precio = $1, descripcion = $2, activo = 1 WHERE id = $3',
          [p.precio, p.descripcion ?? null, existente.id],
        );
        prodId = existente.id;
        actualizados++;
      } else {
        const r = await uno(
          `INSERT INTO productos (categoria_id, nombre, descripcion, precio)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [catId, p.nombre, p.descripcion ?? null, p.precio],
        );
        prodId = r.id;
        nuevos++;
      }
      vistos.add(prodId);

      // Ingredientes: se reemplazan por completo con los del archivo.
      await db.query('DELETE FROM producto_ingredientes WHERE producto_id = $1', [prodId]);
      for (const ing of p.ingredientes ?? []) {
        await db.query(
          'INSERT INTO ingredientes (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING',
          [ing],
        );
        const { id } = await uno('SELECT id FROM ingredientes WHERE nombre = $1', [ing]);
        await db.query(
          `INSERT INTO producto_ingredientes (producto_id, ingrediente_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [prodId, id],
        );
      }
    }
  }

  const { rows: todos } = await db.query('SELECT id FROM productos WHERE activo = 1');
  const sobrantes = todos.filter((p) => !vistos.has(p.id));
  for (const p of sobrantes) {
    await db.query('UPDATE productos SET activo = 0 WHERE id = $1', [p.id]);
  }

  await db.query('COMMIT');
  console.log(
    `Carta sincronizada: ${nuevos} nuevos, ${actualizados} actualizados, ` +
      `${sobrantes.length} desactivados.`,
  );

  const { rows: sinPrecio } = await db.query(
    'SELECT nombre FROM productos WHERE activo = 1 AND precio = 0',
  );
  if (sinPrecio.length) {
    console.warn(
      '\nOJO: estos productos quedaron en $0, hay que ponerles precio en carta.json:',
    );
    for (const p of sinPrecio) console.warn('  -', p.nombre);
  }
} catch (e) {
  await db.query('ROLLBACK');
  console.error('No se pudo sincronizar:', e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
