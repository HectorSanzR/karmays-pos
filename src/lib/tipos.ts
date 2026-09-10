export type TipoPedido = 'mesa' | 'domicilio' | 'llevar';

export type EstadoPedido =
  | 'abierto'
  | 'en_cocina'
  | 'listo'
  | 'en_camino'
  | 'entregado'
  | 'pagado'
  | 'anulado';

export type MetodoPago =
  | 'efectivo'
  | 'nequi'
  | 'daviplata'
  | 'bre_b'
  | 'tarjeta'
  | 'transferencia';

export type Rol =
  | 'admin'
  | 'cajero'
  | 'mesero'
  | 'recepcion'
  | 'despachador'
  | 'domiciliario';

export interface Categoria {
  id: number;
  nombre: string;
  orden: number;
}

export interface Producto {
  id: number;
  categoria_id: number | null;
  categoria: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  activo: number;
}

export interface Usuario {
  id: number;
  nombre: string;
  rol: Rol;
  codigo: string;
  telefono: string | null;
  domiciliario_id: number | null;
  activo: number;
  creado_en: string;
}

export interface Domiciliario {
  id: number;
  nombre: string;
  telefono: string | null;
  activo: number;
}

export interface Mesa {
  id: number;
  nombre: string;
  zona: string;
  capacidad: number;
}

export interface MesaConEstado extends Mesa {
  pedido_id: number | null;
  total: number;
  items: number;
  abierta_desde: string | null;
}

export interface PedidoItem {
  id: number;
  pedido_id: number;
  producto_id: number | null;
  nombre: string;
  precio_unit: number;
  cantidad: number;
  notas: string | null;
  estado: 'pendiente' | 'enviado' | 'anulado';
  creado_en: string;
}

export interface Pedido {
  id: number;
  /** Consecutivo que ve la gente; arranca de nuevo en cada turno de caja. */
  numero: number | null;
  /** Turno en que se tomo el pedido, que define su serie de numeracion. */
  turno_id: number | null;
  tipo: TipoPedido;
  estado: EstadoPedido;
  mesa_id: number | null;
  mesa_nombre: string | null;
  comensales: number | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  cliente_direccion: string | null;
  cliente_notas: string | null;
  repartidor: string | null;
  domiciliario_id: number | null;
  domiciliario_nombre: string | null;
  valor_domicilio: number;
  descuento: number;
  propina: number;
  caja_sesion_id: number | null;
  creado_en: string;
  cerrado_en: string | null;
}

export interface Cuenta {
  subtotal: number;
  descuento: number;
  domicilio: number;
  propina: number;
  total: number;
  pagado: number;
  saldo: number;
}

export interface PedidoCompleto extends Pedido {
  items: PedidoItem[];
  pagos: Pago[];
  cuenta: Cuenta;
}

export interface Pago {
  id: number;
  pedido_id: number;
  metodo: MetodoPago;
  monto: number;
  recibido: number | null;
  cambio: number | null;
  referencia: string | null;
  creado_en: string;
}

export interface CajaSesion {
  id: number;
  base: number;
  abierta_en: string;
  cerrada_en: string | null;
  conteo_final: number | null;
  notas: string | null;
}
