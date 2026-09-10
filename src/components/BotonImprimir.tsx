'use client';

import { useEffect } from 'react';

/**
 * El boton de imprimir. Con `auto` abre el dialogo apenas carga la pagina:
 * asi cualquier "Imprimir" del sistema es un enlace a
 * /pedido/N/recibo?imprimir=1 y no hay que repetir la logica en cada pantalla.
 */
export function BotonImprimir({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;

    // Un respiro para que el navegador termine de pintar el recibo; si no,
    // algunos sacan la hoja a medio dibujar. El temporizador se cancela al
    // desmontar, que es lo que hace que solo salga una impresion aunque React
    // monte el efecto dos veces en desarrollo.
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [auto]);

  return (
    <button onClick={() => window.print()} className="btn-marca px-5 py-2 text-sm">
      Imprimir
    </button>
  );
}
