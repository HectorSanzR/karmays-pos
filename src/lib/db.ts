import pg from 'pg';
import carta from '../../carta.json';

const { Pool, types } = pg;

// Postgres devuelve los enteros grandes y los numeric como texto, y COUNT y
// SUM caen ahi. Como aqui la plata siempre es en pesos enteros, se leen como
// numeros y se acaba el problema de sumar "46000" + "32500" = "4600032500".
types.setTypeParser(types.builtins.INT8, (v) => Number(v));
types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));

declare global {
  var __posPool: pg.Pool | undefined;
}

function crearPool(): pg.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'Falta DATABASE_URL. Es la cadena de conexion de tu base Postgres (usa ' +
        'la conexion agrupada). En local va en .env.local y en Netlify en las ' +
        'variables de entorno del sitio.',
    );
  }

  const local = url.includes('localhost') || url.includes('127.0.0.1');

  return new Pool({
    connectionString: url,
    // Cada funcion serverless abre su propio pool: pocos, y que se suelten
    // rapido, para no agotar las conexiones del proyecto.
    max: Number(process.env.PG_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
}

function pool(): pg.Pool {
  return (globalThis.__posPool ??= crearPool());
}

/** Traduce los `?` de toda la vida a los $1..$n que espera Postgres. */
function numerar(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

type Args = readonly unknown[];

export const db = {
  async all<T>(sql: string, ...args: Args): Promise<T[]> {
    const r = await pool().query(numerar(sql), args as unknown[]);
    return r.rows as T[];
  },

  async get<T>(sql: string, ...args: Args): Promise<T | undefined> {
    const r = await pool().query(numerar(sql), args as unknown[]);
    return r.rows[0] as T | undefined;
  },

  /** Para INSERT/UPDATE/DELETE. Con `RETURNING id` devuelve ese id. */
  async run(sql: string, ...args: Args): Promise<number | undefined> {
    const r = await pool().query(numerar(sql), args as unknown[]);
    return (r.rows[0] as { id?: number } | undefined)?.id;
  },
};

export function ahora(): string {
  return new Date().toISOString();
}

export interface Negocio {
  nombre?: string;
  telefonos?: string[];
}

/**
 * Los datos del negocio salen de carta.json, importado y no leido del disco:
 * en Netlify la funcion no corre desde la carpeta del proyecto.
 */
export function negocio(): Negocio | undefined {
  return (carta as { negocio?: Negocio }).negocio;
}
