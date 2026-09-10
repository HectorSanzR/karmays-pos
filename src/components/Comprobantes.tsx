'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hora } from '@/lib/formato';
import type { Comprobante } from '@/lib/consultas';

/** Una foto de celular pesa varios megas; a la base va una copia liviana. */
const LADO_MAXIMO = 1400;
const CALIDAD = 0.7;

async function achicar(archivo: File | Blob): Promise<Blob> {
  const mapa = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(mapa.width, mapa.height));

  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(mapa.width * escala);
  lienzo.height = Math.round(mapa.height * escala);
  lienzo.getContext('2d')!.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);

  return new Promise((resolver, rechazar) =>
    lienzo.toBlob(
      (b) => (b ? resolver(b) : rechazar(new Error('No se pudo procesar la imagen'))),
      'image/jpeg',
      CALIDAD,
    ),
  );
}

/** La primera imagen que venga en un portapapeles o en un arrastre. */
function primeraImagen(datos: DataTransfer | null): File | null {
  if (!datos) return null;

  for (const archivo of Array.from(datos.files)) {
    if (archivo.type.startsWith('image/')) return archivo;
  }
  for (const item of Array.from(datos.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const archivo = item.getAsFile();
      if (archivo) return archivo;
    }
  }
  return null;
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
  const [borrando, setBorrando] = useState<number | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState('');
  const entrada = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const borrar = async (id: number) => {
    setError('');
    setBorrando(id);
    try {
      const r = await fetch(`/api/comprobante/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const datos = await r.json().catch(() => ({}));
        throw new Error(datos.error ?? 'No se pudo quitar');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar');
    } finally {
      setBorrando(null);
    }
  };

  const subir = useCallback(
    async (archivo: File) => {
      setError('');
      setSubiendo(true);
      try {
        const liviana = await achicar(archivo);
        const cuerpo = new FormData();
        cuerpo.set('pedido_id', String(pedidoId));
        cuerpo.set(
          'archivo',
          new File([liviana], 'comprobante.jpg', { type: 'image/jpeg' }),
        );

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
    },
    [pedidoId, router],
  );

  // Pegar con Ctrl+V. En el PC la captura de pantalla ya queda en el
  // portapapeles: obligar a guardarla en disco para despues buscarla era el
  // paso que sobraba.
  useEffect(() => {
    const alPegar = (e: ClipboardEvent) => {
      const archivo = primeraImagen(e.clipboardData);
      if (!archivo) return;
      e.preventDefault();
      void subir(archivo);
    };

    document.addEventListener('paste', alPegar);
    return () => document.removeEventListener('paste', alPegar);
  }, [subir]);

  return (
    <div className="space-y-3">
      {!compacto && <p className="etiqueta">Comprobante del pago</p>}

      {comprobantes.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {comprobantes.map((c) => (
            <li key={c.id} className="relative">
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

              <button
                type="button"
                disabled={borrando === c.id}
                aria-label="Quitar este comprobante"
                onClick={() => {
                  if (confirm('¿Quitar esta imagen del pedido?')) void borrar(c.id);
                }}
                className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full border border-alerta/50 bg-fondo text-sm text-alerta shadow disabled:opacity-40"
              >
                {borrando === c.id ? '·' : '✕'}
              </button>

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

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          const archivo = primeraImagen(e.dataTransfer);
          if (archivo) void subir(archivo);
          else setError('Eso que soltaste no es una imagen');
        }}
        className={`rounded-xl border-2 border-dashed p-3 text-center transition ${
          arrastrando ? 'border-marca bg-marca/10' : 'border-borde'
        }`}
      >
        <button
          type="button"
          disabled={subiendo}
          onClick={() => entrada.current?.click()}
          className="btn-neutro w-full py-3 text-sm"
        >
          {subiendo
            ? 'Guardando...'
            : comprobantes.length > 0
              ? 'Agregar otra imagen'
              : 'Elegir imagen o tomar foto'}
        </button>

        <p className="mt-2 text-xs text-suave">
          {arrastrando
            ? 'Suelta la imagen aqui'
            : 'Tambien puedes arrastrarla aqui, o pegarla con Ctrl+V'}
        </p>
      </div>

      {error && <p className="text-sm text-alerta">{error}</p>}

      {!compacto && comprobantes.length === 0 && (
        <p className="text-xs text-suave">
          La pantalla del pago de Nequi, Bre-B o la transferencia. En el
          computador, con Win+Shift+S recortas la pantalla y la pegas aqui de
          una vez.
        </p>
      )}
    </div>
  );
}
