import { dinero } from '@/lib/formato';

/**
 * Como va la plata de un pedido en las listas. El abono importa tanto como el
 * pago completo: si el cliente adelanto una parte, quien despacha tiene que
 * verlo antes de mandar al domiciliario a cobrar de mas.
 */
export function ChipCuenta({ pagado, total }: { pagado: number; total: number }) {
  if (total <= 0 || pagado <= 0) return null;

  if (pagado >= total) {
    return <span className="chip bg-ok/15 text-ok">Pagado</span>;
  }

  return (
    <span className="chip bg-info/15 text-info">
      Abonado {dinero(pagado)} · falta {dinero(total - pagado)}
    </span>
  );
}
