import Link from 'next/link';
import { exigir } from '@/lib/sesion';
import { notFound } from 'next/navigation';
import { obtenerPedido } from '@/lib/consultas';
import { negocio } from '@/lib/db';
import { dinero, etiquetaOrden, hora, nombreMetodo } from '@/lib/formato';
import { BotonImprimir } from '@/components/BotonImprimir';

export const dynamic = 'force-dynamic';

export default async function Recibo({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ imprimir?: string; cuenta?: string }>;
}) {
  await exigir('cobrar');
  const { id } = await params;
  const { imprimir, cuenta } = await searchParams;
  const p = await obtenerPedido(Number(id));
  if (!p) notFound();

  const datos = negocio();
  // La cuenta es la misma hoja, pero antes de pagar: sin los pagos y dicho
  // con todas las letras, para que nadie la confunda con un recibo.
  const esCuenta = cuenta === '1';

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href={`/pedido/${p.id}`}
          className="text-sm text-suave hover:text-texto"
        >
          ← Volver al pedido
        </Link>
        <BotonImprimir auto={imprimir === '1'} />
      </div>

      <div className="mx-auto w-full bg-white p-6 font-mono text-[13px] leading-relaxed text-black print:p-0">
        <div className="text-center">
          <p className="text-base font-bold uppercase">
            {datos?.nombre ?? 'Restaurante'}
          </p>
          {datos?.telefonos?.length ? (
            <p>{datos.telefonos.join(' · ')}</p>
          ) : null}
          {esCuenta && <p className="mt-1 text-base font-bold">CUENTA</p>}
          <p className="mt-2">
            {etiquetaOrden(p.numero, p.creado_en, p.id)}
            <br />
            {hora(p.creado_en)}
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

        {esCuenta ? (
          <p className="text-center">Esta cuenta no es comprobante de pago</p>
        ) : (
          <>
            {p.pagos.map((pg) => (
              <Linea key={pg.id} k={nombreMetodo(pg.metodo)} v={dinero(pg.monto)} />
            ))}
            {p.pagos.some((pg) => (pg.cambio ?? 0) > 0) && (
              <Linea
                k="Cambio"
                v={dinero(p.pagos.reduce((s, pg) => s + (pg.cambio ?? 0), 0))}
              />
            )}
            {/* Una cuenta partida se puede imprimir a medio pagar; decirlo
                evita que el papel parezca un paz y salvo. */}
            {p.cuenta.saldo > 0 && (
              <div className="mt-1 flex justify-between border-t border-black pt-1 font-bold">
                <span>FALTA POR PAGAR</span>
                <span>{dinero(p.cuenta.saldo)}</span>
              </div>
            )}
          </>
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
