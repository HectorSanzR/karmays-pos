import { NextResponse } from 'next/server';

/**
 * TEMPORAL: sirve para averiguar que variables de entorno ve la funcion en
 * Netlify. Devuelve solo nombres y longitudes, nunca valores. Se borra apenas
 * quede resuelto el despliegue.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const claves = Object.keys(process.env).sort();

  return NextResponse.json({
    total_variables: claves.length,
    tiene_database_url: 'DATABASE_URL' in process.env,
    largo_database_url: (process.env.DATABASE_URL ?? '').length,
    // Un par de variables que Netlify siempre pone, para saber si el entorno
    // llego completo o si esta vacio del todo.
    marcadores_netlify: {
      NETLIFY: 'NETLIFY' in process.env,
      SITE_NAME: 'SITE_NAME' in process.env,
      CONTEXT: process.env.CONTEXT ?? null,
      NODE_VERSION: process.env.NODE_VERSION ?? null,
    },
    // Nombres unicamente, para ver si la nuestra aparece con otro nombre.
    nombres: claves,
  });
}
