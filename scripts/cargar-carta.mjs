/**
 * Sincroniza carta.json con la base del POS.
 *   npm run carta
 *
 * Es idempotente y no destructivo: actualiza precios, agrega lo nuevo y
 * desactiva (activo = 0) lo que ya no este en el archivo, para que los
 * pedidos viejos sigan mostrando bien sus productos.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const raiz = process.cwd();
const rutaCarta = path.join(raiz, 'carta.json');
const rutaDb = path.join(raiz, 'datos', 'pos.db');

if (!fs.existsSync(rutaCarta)) {
  console.error('No encuentro carta.json en', raiz);
  process.exit(1);
}
if (!fs.existsSync(rutaDb)) {
  console.error('No encuentro datos/pos.db. Arranca el POS una vez con "npm run dev".');
  process.exit(1);
}

const carta = JSON.parse(fs.readFileSync(rutaCarta, 'utf8'));
const db = new DatabaseSync(rutaDb);
db.exec('PRAGMA foreign_keys = ON;');

const vistos = new Set();
let nuevos = 0;
let actualizados = 0;

db.exec('BEGIN');
try {
  carta.categorias.forEach((cat, orden) => {
    let fila = db.prepare('SELECT id FROM categorias WHERE nombre = ?').get(cat.nombre);
    if (!fila) {
      db.prepare('INSERT INTO categorias (nombre, orden) VALUES (?, ?)').run(
        cat.nombre,
        orden,
      );
      fila = db.prepare('SELECT id FROM categorias WHERE nombre = ?').get(cat.nombre);
    } else {
      db.prepare('UPDATE categorias SET orden = ? WHERE id = ?').run(orden, fila.id);
    }
    const catId = fila.id;

    for (const p of cat.productos) {
      const existente = db
        .prepare('SELECT id FROM productos WHERE categoria_id = ? AND nombre = ?')
        .get(catId, p.nombre);

      let prodId;
      if (existente) {
        db.prepare(
          'UPDATE productos SET precio = ?, descripcion = ?, activo = 1 WHERE id = ?',
        ).run(p.precio, p.descripcion ?? null, existente.id);
        prodId = existente.id;
        actualizados++;
      } else {
        const r = db
          .prepare(
            `INSERT INTO productos (categoria_id, nombre, descripcion, precio)
             VALUES (?, ?, ?, ?)`,
          )
          .run(catId, p.nombre, p.descripcion ?? null, p.precio);
        prodId = Number(r.lastInsertRowid);
        nuevos++;
      }
      vistos.add(prodId);

      // Ingredientes: se reemplazan por completo con los del archivo.
      db.prepare('DELETE FROM producto_ingredientes WHERE producto_id = ?').run(prodId);
      for (const ing of p.ingredientes ?? []) {
        db.prepare('INSERT OR IGNORE INTO ingredientes (nombre) VALUES (?)').run(ing);
        const { id } = db.prepare('SELECT id FROM ingredientes WHERE nombre = ?').get(ing);
        db.prepare(
          `INSERT OR REPLACE INTO producto_ingredientes (producto_id, ingrediente_id)
           VALUES (?, ?)`,
        ).run(prodId, id);
      }
    }
  });

  const todos = db.prepare('SELECT id FROM productos WHERE activo = 1').all();
  const sobrantes = todos.filter((p) => !vistos.has(p.id));
  for (const p of sobrantes) {
    db.prepare('UPDATE productos SET activo = 0 WHERE id = ?').run(p.id);
  }

  db.exec('COMMIT');
  console.log(
    `Carta sincronizada: ${nuevos} nuevos, ${actualizados} actualizados, ` +
      `${sobrantes.length} desactivados.`,
  );

  const sinPrecio = db
    .prepare('SELECT nombre FROM productos WHERE activo = 1 AND precio = 0')
    .all();
  if (sinPrecio.length) {
    console.warn(
      '\nOJO: estos productos quedaron en $0, hay que ponerles precio en carta.json:',
    );
    for (const p of sinPrecio) console.warn('  -', p.nombre);
  }
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}
