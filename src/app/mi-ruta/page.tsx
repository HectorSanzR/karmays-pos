import {
  cajaAbierta,
  controlDomiciliarios,
  pedidosDeDomiciliario,
} from '@/lib/consultas';
import { inicioDelDia } from '@/lib/formato';
import { exigir } from '@/lib/sesion';
import { MiRuta } from '@/components/MiRuta';

export const dynamic = 'force-dynamic';

export default async function PaginaMiRuta() {
  const usuario = await exigir('mi-ruta');

  if (!usuario.domiciliario_id) {
    return (
      <p className="p-8 text-center text-sm text-suave">
        Tu usuario no tiene ficha de domiciliario. Avisale al administrador.
      </p>
    );
  }

  const mio = controlDomiciliarios(inicioDelDia()).find(
    (d) => d.id === usuario.domiciliario_id,
  );

  return (
    <MiRuta
      pedidos={pedidosDeDomiciliario(usuario.domiciliario_id)}
      porCobrar={mio?.por_cobrar ?? 0}
      efectivoHoy={mio?.efectivo_hoy ?? 0}
      cobradoHoy={mio?.cobrado_hoy ?? 0}
      entregasHoy={mio?.entregas_hoy ?? 0}
      porMetodo={mio?.porMetodo ?? []}
      hayCaja={!!cajaAbierta()}
    />
  );
}
