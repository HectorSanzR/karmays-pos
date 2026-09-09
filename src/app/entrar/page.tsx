import { redirect } from 'next/navigation';
import { hayUsuarios, usuarioActual, PERMISOS } from '@/lib/sesion';
import { leerCarta } from '@/lib/db';
import { Entrar } from '@/components/Entrar';
import { PrimerAdmin } from '@/components/PrimerAdmin';

export const dynamic = 'force-dynamic';

export default async function PaginaEntrar() {
  const usuario = await usuarioActual();
  if (usuario) redirect(PERMISOS[usuario.rol].inicio);

  const negocio = leerCarta()?.negocio?.nombre ?? 'POS';

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-marca text-2xl text-black">
            ●
          </div>
          <h1 className="text-xl font-bold">{negocio}</h1>
        </div>

        {hayUsuarios() ? <Entrar /> : <PrimerAdmin />}
      </div>
    </div>
  );
}
