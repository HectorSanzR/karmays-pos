import Link from 'next/link';
import { exigir } from '@/lib/sesion';
import { notFound } from 'next/navigation';
import { obtenerPedido } from '@/lib/consultas';
import { leerCarta } from '@/lib/db';
import { dinero, hora } from '@/lib/formato';
import { BotonImprimir } from '@/components/BotonImprimir';

export const dynamic = 'force-dynamic';

export default async function Recibo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigir('cobrar');
  const { id } = await params;
  const p = obtenerPedido(Number(id));
  if (!p) notFound();

  const negocio = leerCarta()?.negocio;

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex justify-between print:hidden">
        <Link href="/" className="text-sm text-suave hover:text-texto">
          ← Inicio
        </Link>
        <BotonImprimir />
      </div>

      <div className="mx-auto w-full bg-white p-6 font-mono text-[13px] leading-relaxed text-black print:p-0">
        <div className="text-center">
          <p className="text-base font-bold uppercase">
            {negocio?.nombre ?? 'Restaurante'}
          </p>
          {negocio?.telefonos?.length ? (
            <p>{negocio.telefonos.join(' · ')}</p>
          ) : null}
          <p className="mt-2">
            Pedido #{p.id} · {hora(p.creado_en)}
          </p>
          <p>
            {p.mesa_nombre ?? (p.tipo === 'domicilio' ? 'Domicilio' : 'Para llevar')}
          </p>
        </div>

        <div className="my-3 border-t border-dashed border-black" />

        <table className="w-full">
          <tbody>
            {p.items.map((i) => (
              <tr key={i.id} className="align-top">
                <td className="pr-2">{i.cantidad}</td>
                <td className="w-full">
                  {i.nombre}
                  {i.notas && <div className="pl-2 text-[11px]">({i.notas})</div>}
                </td>
                <td className="whitespace-nowrap text-right">
                  {dinero(i.precio_unit * i.cantidad)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="my-3 border-t border-dashed border-black" />

        <Linea k="Subtotal" v={dinero(p.cuenta.subtotal)} />
        {p.cuenta.descuento > 0 && (
          <Linea k="Descuento" v={`-${dinero(p.cuenta.descuento)}`} />
        )}
        {p.cuenta.domicilio > 0 && <Linea k="Domicilio" v={dinero(p.cuenta.domicilio)} />}
        {p.cuenta.propina > 0 && <Linea k="Propina" v={dinero(p.cuenta.propina)} />}
        <div className="mt-1 flex justify-between border-t border-black pt-1 text-base font-bold">
          <span>TOTAL</span>
          <span>{dinero(p.cuenta.total)}</span>
        </div>

        <div className="my-3 border-t border-dashed border-black" />

        {p.pagos.map((pg) => (
          <Linea key={pg.id} k={pg.metodo} v={dinero(pg.monto)} />
        ))}
        {p.pagos.some((pg) => (pg.cambio ?? 0) > 0) && (
          <Linea
            k="Cambio"
            v={dinero(p.pagos.reduce((s, pg) => s + (pg.cambio ?? 0), 0))}
          />
        )}

        <p className="mt-4 text-center">Gracias por su visita</p>
      </div>
    </div>
  );
}

function Linea({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between capitalize">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
