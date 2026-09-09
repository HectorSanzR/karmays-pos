const estilos: Record<string, { texto: string; clase: string }> = {
  abierto: { texto: 'Abierto', clase: 'bg-info/15 text-info' },
  en_cocina: { texto: 'En cocina', clase: 'bg-marca/15 text-marca' },
  listo: { texto: 'Listo', clase: 'bg-ok/15 text-ok' },
  en_camino: { texto: 'En camino', clase: 'bg-info/15 text-info' },
  entregado: { texto: 'Entregado', clase: 'bg-ok/15 text-ok' },
  pagado: { texto: 'Pagado', clase: 'bg-ok/20 text-ok' },
  anulado: { texto: 'Anulado', clase: 'bg-alerta/15 text-alerta' },
};

export function EstadoChip({ estado }: { estado: string }) {
  const e = estilos[estado] ?? { texto: estado, clase: 'bg-panel2 text-suave' };
  return <span className={`chip ${e.clase}`}>{e.texto}</span>;
}
