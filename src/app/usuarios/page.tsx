import { listarUsuarios } from '@/lib/consultas';
import { crearUsuario } from '@/lib/acciones';
import { exigir, PERMISOS } from '@/lib/sesion';
import { FilaUsuario } from '@/components/FilaUsuario';
import type { Rol } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

const ROLES: [Rol, string][] = [
  ['mesero', 'Mesero — solo mesas y comandas'],
  ['recepcion', 'Recepcion — toma los domicilios'],
  ['despachador', 'Despacho — asigna los domicilios'],
  ['domiciliario', 'Domiciliario — solo sus entregas'],
  ['cajero', 'Cajero — cobra y cuadra caja'],
  ['admin', 'Administrador — todo'],
];

export default async function Usuarios() {
  const yo = await exigir('usuarios');
  const gente = await listarUsuarios();

  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[340px_1fr]">
      <section className="tarjeta h-fit min-w-0 p-4">
        <h2 className="mb-1 text-lg font-bold">Nueva persona</h2>
        <p className="mb-4 text-sm text-suave">
          Al crearla se genera un codigo de 4 numeros. Ese codigo es su llave:
          se lo dictas y con eso entra.
        </p>
        <form action={crearUsuario} className="space-y-3">
          <div>
            <label className="etiqueta" htmlFor="nombre">
              Nombre
            </label>
            <input id="nombre" name="nombre" className="campo" required />
          </div>
          <div>
            <label className="etiqueta" htmlFor="rol">
              Que puede hacer
            </label>
            <select id="rol" name="rol" className="campo" defaultValue="mesero">
              {ROLES.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="telefono">
              Telefono
            </label>
            <input
              id="telefono"
              name="telefono"
              className="campo"
              inputMode="tel"
              placeholder="Opcional"
            />
          </div>
          <button type="submit" className="btn-marca w-full">
            Crear
          </button>
        </form>
      </section>

      <section className="tarjeta min-w-0 overflow-hidden">
        <h2 className="border-b border-borde px-4 py-3 font-semibold">
          Personas ({gente.length})
        </h2>
        <p className="border-b border-borde px-4 py-2 text-xs text-suave">
          Apaga el acceso al cerrar el turno: la persona queda por fuera de
          inmediato aunque tenga la sesion abierta.
        </p>
        <ul className="divide-y divide-borde">
          {gente.map((u) => (
            <FilaUsuario
              key={u.id}
              usuario={u}
              etiquetaRol={PERMISOS[u.rol].etiqueta}
              esYo={u.id === yo.id}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
