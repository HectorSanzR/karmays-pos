/**
 * Valores compartidos entre el middleware (que corre en runtime edge y no
 * puede tocar la base) y el servidor. Este archivo no debe importar nada.
 */
export const COOKIE = 'pos_sesion';
