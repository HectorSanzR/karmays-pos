'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hora } from '@/lib/formato';
import type { Comprobante } from '@/lib/consultas';

/** Una foto de celular pesa varios megas; a la base va una copia liviana. */
const LADO_MAXIMO = 1400;
const CALIDAD = 0.7;

async function achicar(archivo: File): Promise<Blob> {
  const mapa = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(mapa.width, mapa.height));

  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(mapa.width * escala);
  lienzo.height = Math.round(mapa.height * escala);
  lienzo.getContext('2d')!.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);

  return new Promise((resolver, rechazar) =>
    lienzo.toBlob(
      (b) => (b ? resolver(b) : rechazar(new Error('No se pudo procesar la foto'))),
      'image/jpeg',
      CALIDAD,
    ),
  );
}

export function Comprobantes({
  pedidoId,
  comprobantes,
  compacto = false,
}: {
  pedidoId: number;
  comprobantes: Comprobante[];
  compacto?: boolean;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const entrada = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const subir = async (archivo: File) => {
    setError('');
    setSubiendo(true);
    try {
      const liviana = await achicar(archivo);
      const cuerpo = new FormData();
      cuerpo.set('pedido_id', String(pedidoId));
      cuerpo.set('archivo', new File([liviana], 'comprobante.jpg', { type: 'image/jpeg' }));

      const r = await fetch('/api/comprobante', { method: 'POST', body: cuerpo });
      if (!r.ok) {
        const datos = await r.json().catch(() => ({}));
        throw new Error(datos.error ?? 'No se pudo guardar');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {!compacto && <p className="etiqueta">Comprobante del pago</p>}

      {comprobantes.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {comprobantes.map((c) => (
            <li key={c.id}>
              <a
                href={`/api/comprobante/${c.id}`}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg border border-borde"
                title={`${hora(c.creado_en)}${c.subido_por ? ` · ${c.subido_por}` : ''}`}
              >
                {/* Sin next/image: la ruta pide sesion y no pasa por el
                    optimizador. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/comprobante/${c.id}`}
                  alt={`Comprobante ${c.id}`}
                  className="h-24 w-24 object-cover"
                />
              </a>
              <p className="mt-1 text-center text-[10px] text-suave">
                {hora(c.creado_en)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void subir(f);
        }}
      />

      <button
        type="button"
        disabled={subiendo}
        onClick={() => entrada.current?.click()}
        className="btn-neutro w-full py-3 text-sm"
      >
        {subiendo
          ? 'Guardando...'
          : comprobantes.length > 0
            ? 'Agregar otra foto'
            : 'Adjuntar comprobante'}
      </button>

      {error && <p className="text-sm text-alerta">{error}</p>}

      {!compacto && comprobantes.length === 0 && (
        <p className="text-xs text-suave">
          La pantalla del pago de Nequi, Bre-B o la transferencia. Queda
          guardada con el pedido, por si despues hay que mostrarla.
        </p>
      )}
    </div>
  );
}
