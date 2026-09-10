const pesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function dinero(v: number): string {
  return pesos.format(v ?? 0);
}

export const NOMBRE_METODO: Record<string, string> = {
  efectivo: 'Efectivo',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  bre_b: 'Bre-B',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

export function nombreMetodo(m: string): string {
  return NOMBRE_METODO[m] ?? m;
}


export function hora(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fecha(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// El mes va a mano: es-CO abrevia septiembre como "sept" y aqui se quieren
// siempre tres letras, como se escribe en una comanda.
const MESES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** 10/sep/2026 */
export function fechaCorta(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const dia = String(d.getDate()).padStart(2, '0');
  return `${dia}/${MESES[d.getMonth()]}/${d.getFullYear()}`;
}

/**
 * Como se nombra un pedido en voz alta: "Orden #3 · 10/sep/2026". El numero
 * arranca de nuevo en cada turno, asi que sin la fecha dos ordenes distintas
 * se llamarian igual.
 */
export function etiquetaOrden(
  numero: number | null,
  creadoEn: string | null,
  id?: number,
): string {
  return `Orden #${numero ?? id ?? 0} · ${fechaCorta(creadoEn)}`;
}

/** Solo el numero, para donde no cabe la fecha. */
export function numeroOrden(numero: number | null, id?: number): string {
  return `#${numero ?? id ?? 0}`;
}

export function transcurrido(iso: string | null): string {
  if (!iso) return '';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recien';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}
