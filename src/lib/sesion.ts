import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import type { Rol, Usuario } from './tipos';

export { COOKIE } from './constantes';
import { COOKIE } from './constantes';

/** Cada pantalla del POS. Los roles se definen como una lista de estas. */
export type Seccion =
  | 'inicio'
  | 'mesas'
  | 'domicilios'
  | 'asignacion'
  | 'domiciliarios'
  | 'mi-ruta'
  | 'cobrar'
  | 'caja'
  | 'historial'
  | 'usuarios';

interface Permiso {
  /** A donde cae la persona al entrar. */
  inicio: string;
  secciones: Seccion[];
  etiqueta: string;
}

export const PERMISOS: Record<Rol, Permiso> = {
  admin: {
    inicio: '/',
    etiqueta: 'Administrador',
    secciones: [
      'inicio',
      'mesas',
      'domicilios',
      'asignacion',
      'domiciliarios',
      'cobrar',
      'caja',
      'historial',
      'usuarios',
    ],
  },
  cajero: {
    inicio: '/',
    etiqueta: 'Caja',
    secciones: [
      'inicio',
      'mesas',
      'domicilios',
      'asignacion',
      'domiciliarios',
      'cobrar',
      'caja',
      'historial',
    ],
  },
  mesero: {
    inicio: '/mesas',
    etiqueta: 'Mesero',
    secciones: ['mesas'],
  },
  // Quien contesta el WhatsApp: toma el pedido y ya. Asignar es de despacho,
  // para que una sola persona no haga las dos cosas.
  recepcion: {
    inicio: '/domicilios',
    etiqueta: 'Recepcion de pedidos',
    secciones: ['domicilios'],
  },
  despachador: {
    inicio: '/asignacion',
    etiqueta: 'Despacho',
    secciones: ['asignacion', 'domiciliarios'],
  },
  domiciliario: {
    inicio: '/mi-ruta',
    etiqueta: 'Domiciliario',
    secciones: ['mi-ruta'],
  },
};

export function puede(usuario: Usuario, seccion: Seccion): boolean {
  return PERMISOS[usuario.rol].secciones.includes(seccion);
}

/** Usuario de la sesion actual, o null si no hay o quedo inhabilitado. */
export async function usuarioActual(): Promise<Usuario | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const fila = await db.get(`SELECT u.* FROM sesiones s
         JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.token = ? AND u.activo = 1`, token);
  return fila ? ({ ...(fila as object) } as Usuario) : null;
}

/**
 * Exige sesion y, si se pide, permiso sobre una seccion. Si no cumple, manda
 * al login o a la pantalla que si le corresponde: nadie ve una pagina que no
 * le toca, ni siquiera escribiendo la direccion a mano.
 */
export async function exigir(seccion?: Seccion): Promise<Usuario> {
  const usuario = await usuarioActual();
  if (!usuario) redirect('/entrar');
  if (seccion && !puede(usuario, seccion)) redirect(PERMISOS[usuario.rol].inicio);
  return usuario;
}

/** Codigo de 4 digitos que no este en uso. */
export async function generarCodigo(): Promise<string> {
  for (let i = 0; i < 200; i++) {
    const codigo = String(Math.floor(1000 + Math.random() * 9000));
    const usado = await db.get('SELECT 1 FROM usuarios WHERE codigo = ?', codigo);
    if (!usado) return codigo;
  }
  throw new Error('No se pudo generar un codigo libre');
}

export async function hayUsuarios(): Promise<boolean> {
  const { n } = await db.get('SELECT COUNT(*) AS n FROM usuarios') as { n: number };
  return n > 0;
}
