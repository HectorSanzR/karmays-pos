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

export function transcurrido(iso: string | null): string {
  if (!iso) return '';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recien';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}
