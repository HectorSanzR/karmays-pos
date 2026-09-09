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
  recepcion: {
    inicio: '/domicilios',
    etiqueta: 'Recepcion de pedidos',
    secciones: ['domicilios', 'domiciliarios'],
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

  const fila = db
    .prepare(
      `SELECT u.* FROM sesiones s
         JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.token = ? AND u.activo = 1`,
    )
    .get(token);
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
export function generarCodigo(): string {
  for (let i = 0; i < 200; i++) {
    const codigo = String(Math.floor(1000 + Math.random() * 9000));
    const usado = db.prepare('SELECT 1 FROM usuarios WHERE codigo = ?').get(codigo);
    if (!usado) return codigo;
  }
  throw new Error('No se pudo generar un codigo libre');
}

export function hayUsuarios(): boolean {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get() as { n: number };
  return n > 0;
}
