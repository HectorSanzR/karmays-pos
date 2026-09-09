'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  agregarItem,
  anularPedido,
  cambiarCantidad,
  cambiarEstadoPedido,
  editarNotas,
  enviarACocina,
  quitarItem,
  actualizarPedido,
} from '@/lib/acciones';
import { dinero, transcurrido } from '@/lib/formato';
import { EstadoChip } from './EstadoChip';
import type {
  Categoria,
  Domiciliario,
  PedidoCompleto,
  PedidoItem,
  Producto,
} from '@/lib/tipos';

interface Props {
  pedido: PedidoCompleto;
  categorias: Categoria[];
  productos: Producto[];
  ingredientes: Record<number, string[]>;
  domiciliarios: Domiciliario[];
}

export function TomaPedido({
  pedido,
  categorias,
  productos,
  ingredientes,
  domiciliarios,
}: Props) {
  const [cat, setCat] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<PedidoItem | null>(null);
  const [verDatos, setVerDatos] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (cat !== null && p.categoria_id !== cat) return false;
      if (!q) return true;
      return `${p.nombre} ${p.categoria ?? ''}`.toLowerCase().includes(q);
    });
  }, [productos, cat, busqueda]);

  const sinEnviar = pedido.items.filter((i) => i.estado === 'pendiente').length;
  const cerrado = pedido.estado === 'pagado' || pedido.estado === 'anulado';
  const titulo =
    pedido.mesa_nombre ?? pedido.cliente_nombre ?? `Pedido #${pedido.id}`;

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_380px]">
      {/* ------------------------------------------------------------ carta */}
      <section className="order-2 min-w-0 space-y-3 lg:order-1">
        <input
          className="campo"
          placeholder="Buscar plato..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Pestana activa={cat === null} onClick={() => setCat(null)}>
            Todo
          </Pestana>
          {categorias.map((c) => (
            <Pestana key={c.id} activa={cat === c.id} onClick={() => setCat(c.id)}>
              {c.nombre}
            </Pestana>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visibles.map((p) => (
            <button
              key={p.id}
              disabled={cerrado || pendiente}
              onClick={() => iniciar(() => void agregarItem(pedido.id, p.id))}
              className="flex h-28 flex-col justify-between rounded-xl border border-borde bg-panel p-3 text-left transition hover:border-marca active:scale-[.98] disabled:opacity-40"
            >
              <span className="min-w-0">
                <span className="line-clamp-2 block text-sm font-semibold">
                  {p.nombre}
                </span>
                {/* Muchos nombres se repiten entre categorias (Pollo, Mixta...),
                    asi que la categoria se muestra siempre que no este filtrada. */}
                {cat === null && p.categoria && (
                  <span className="mt-0.5 block truncate text-[11px] text-suave">
                    {p.categoria}
                  </span>
                )}
              </span>
              <span className="text-sm font-bold text-marca">{dinero(p.precio)}</span>
            </button>
          ))}
          {visibles.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-suave">
              Sin resultados.
            </p>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------- comanda */}
      <aside className="order-1 min-w-0 lg:order-2">
        <div className="tarjeta sticky top-20 flex max-h-[55vh] flex-col lg:max-h-[calc(100vh-6rem)]">
          <header className="flex items-start justify-between gap-2 border-b border-borde p-4">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold">{titulo}</h1>
              <p className="text-xs text-suave">
                #{pedido.id} · {transcurrido(pedido.creado_en)}
                {pedido.comensales ? ` · ${pedido.comensales} pax` : ''}
              </p>
              {pedido.tipo === 'domicilio' && (
                <p className="mt-0.5 text-xs">
                  {pedido.domiciliario_nombre ? (
                    <span className="text-info">🛵 {pedido.domiciliario_nombre}</span>
                  ) : (
                    <span className="text-marca">Sin domiciliario asignado</span>
                  )}
                </p>
              )}
            </div>
            <EstadoChip estado={pedido.estado} />
          </header>

          <div className="flex-1 overflow-y-auto">
            {pedido.items.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-suave">
                Toca un plato de la carta para agregarlo.
              </p>
            ) : (
              <ul className="divide-y divide-borde">
                {pedido.items.map((it) => (
                  <li key={it.id} className="flex items-start gap-2 px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        disabled={cerrado || pendiente}
                        onClick={() => iniciar(() => void cambiarCantidad(it.id, -1))}
                        className="h-8 w-8 rounded-lg border border-borde text-lg leading-none disabled:opacity-40"
                        aria-label="Quitar uno"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-bold">{it.cantidad}</span>
                      <button
                        disabled={cerrado || pendiente}
                        onClick={() => iniciar(() => void cambiarCantidad(it.id, 1))}
                        className="h-8 w-8 rounded-lg border border-borde text-lg leading-none disabled:opacity-40"
                        aria-label="Agregar uno"
                      >
                        +
                      </button>
                    </div>

                    <button
                      disabled={cerrado}
                      onClick={() => setEditando(it)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-semibold">{it.nombre}</p>
                      {it.notas && (
                        <p className="truncate text-xs text-marca">{it.notas}</p>
                      )}
                      {it.estado === 'pendiente' && (
                        <p className="text-[10px] uppercase text-suave">sin enviar</p>
                      )}
                    </button>

                    <span className="w-20 text-right text-sm font-semibold">
                      {dinero(it.precio_unit * it.cantidad)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="space-y-3 border-t border-borde p-4">
            <Totales pedido={pedido} />

            {!cerrado && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={sinEnviar === 0 || pendiente}
                  onClick={() => iniciar(() => void enviarACocina(pedido.id))}
                  className="btn-neutro"
                >
                  Enviar a cocina{sinEnviar > 0 ? ` (${sinEnviar})` : ''}
                </button>
                <Link
                  href={`/pedido/${pedido.id}/cobrar`}
                  className={`btn-marca ${
                    pedido.items.length === 0 ? 'pointer-events-none opacity-40' : ''
                  }`}
                >
                  Cobrar
                </Link>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button onClick={() => setVerDatos(true)} className="btn-neutro flex-1 py-2">
                Datos
              </button>
              {pedido.tipo === 'domicilio' && !cerrado && (
                <SelectorEstado pedido={pedido} onCambio={iniciar} />
              )}
            </div>

            {!cerrado && (
              <button
                onClick={() => {
                  if (confirm('¿Anular este pedido? No se podra cobrar.'))
                    iniciar(() => void anularPedido(pedido.id));
                }}
                className="btn-peligro w-full py-2 text-xs"
              >
                Anular pedido
              </button>
            )}
          </footer>
        </div>
      </aside>

      {editando && (
        <ModalItem
          item={editando}
          ingredientes={
            editando.producto_id ? (ingredientes[editando.producto_id] ?? []) : []
          }
          onCerrar={() => setEditando(null)}
        />
      )}

      {verDatos && (
        <ModalDatos
          pedido={pedido}
          domiciliarios={domiciliarios}
          onCerrar={() => setVerDatos(false)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------- auxiliares */

function Pestana({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${
        activa ? 'bg-marca text-black' : 'border border-borde bg-panel text-suave'
      }`}
    >
      {children}
    </button>
  );
}

function Totales({ pedido }: { pedido: PedidoCompleto }) {
  const c = pedido.cuenta;
  return (
    <dl className="space-y-1 text-sm">
      <Fila k="Subtotal" v={dinero(c.subtotal)} />
      {c.descuento > 0 && <Fila k="Descuento" v={`- ${dinero(c.descuento)}`} />}
      {c.domicilio > 0 && <Fila k="Domicilio" v={dinero(c.domicilio)} />}
      {c.propina > 0 && <Fila k="Propina" v={dinero(c.propina)} />}
      <div className="flex justify-between border-t border-borde pt-2 text-lg font-bold">
        <dt>Total</dt>
        <dd className="text-marca">{dinero(c.total)}</dd>
      </div>
      {c.pagado > 0 && (
        <>
          <Fila k="Pagado" v={dinero(c.pagado)} />
          <Fila k="Saldo" v={dinero(c.saldo)} />
        </>
      )}
    </dl>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-suave">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

const ESTADOS_DOM = [
  ['en_cocina', 'En cocina'],
  ['listo', 'Listo'],
  ['en_camino', 'En camino'],
  ['entregado', 'Entregado'],
] as const;

function SelectorEstado({
  pedido,
  onCambio,
}: {
  pedido: PedidoCompleto;
  onCambio: (fn: () => void) => void;
}) {
  return (
    <select
      className="campo flex-1 py-2 text-sm"
      value={pedido.estado}
      onChange={(e) =>
        onCambio(() => void cambiarEstadoPedido(pedido.id, e.target.value))
      }
    >
      <option value="abierto">Abierto</option>
      {ESTADOS_DOM.map(([v, t]) => (
        <option key={v} value={v}>
          {t}
        </option>
      ))}
    </select>
  );
}

function Modal({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        className="tarjeta max-h-[90vh] w-full max-w-lg overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-borde p-4">
          <h2 className="font-bold">{titulo}</h2>
          <button onClick={onCerrar} className="text-suave hover:text-texto">
            ✕
          </button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function ModalItem({
  item,
  ingredientes,
  onCerrar,
}: {
  item: PedidoItem;
  ingredientes: string[];
  onCerrar: () => void;
}) {
  const inicial = item.notas ?? '';
  const [texto, setTexto] = useState(inicial);
  const [pendiente, iniciar] = useTransition();

  const alternar = (frase: string) => {
    setTexto((t) => {
      const partes = t
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const i = partes.indexOf(frase);
      if (i >= 0) partes.splice(i, 1);
      else partes.push(frase);
      return partes.join(', ');
    });
  };

  const activa = (frase: string) =>
    texto
      .split(',')
      .map((s) => s.trim())
      .includes(frase);

  return (
    <Modal titulo={item.nombre} onCerrar={onCerrar}>
      <div className="space-y-4">
        {ingredientes.length > 0 && (
          <div>
            <p className="etiqueta">Quitar ingredientes</p>
            <div className="flex flex-wrap gap-2">
              {ingredientes.map((ing) => {
                const frase = `sin ${ing.toLowerCase()}`;
                return (
                  <button
                    key={ing}
                    onClick={() => alternar(frase)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      activa(frase)
                        ? 'border-alerta bg-alerta/15 text-alerta'
                        : 'border-borde bg-panel2 text-suave'
                    }`}
                  >
                    {frase}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className="etiqueta" htmlFor="notas">
            Nota para cocina
          </label>
          <textarea
            id="notas"
            className="campo"
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="termino medio, salsa aparte, para llevar..."
          />
        </div>

        <div className="flex gap-2">
          <button
            className="btn-peligro"
            disabled={pendiente}
            onClick={() =>
              iniciar(() => {
                void quitarItem(item.id);
                onCerrar();
              })
            }
          >
            Eliminar
          </button>
          <button
            className="btn-marca flex-1"
            disabled={pendiente}
            onClick={() =>
              iniciar(() => {
                void editarNotas(item.id, texto);
                onCerrar();
              })
            }
          >
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ModalDatos({
  pedido,
  domiciliarios,
  onCerrar,
}: {
  pedido: PedidoCompleto;
  domiciliarios: Domiciliario[];
  onCerrar: () => void;
}) {
  const esDomicilio = pedido.tipo === 'domicilio';

  return (
    <Modal titulo="Datos del pedido" onCerrar={onCerrar}>
      <form
        action={async (fd) => {
          await actualizarPedido(fd);
          onCerrar();
        }}
        className="space-y-3"
      >
        <input type="hidden" name="pedido_id" value={pedido.id} />

        {esDomicilio ? (
          <>
            <Campo name="cliente_nombre" label="Cliente" def={pedido.cliente_nombre} />
            <Campo
              name="cliente_telefono"
              label="Telefono"
              def={pedido.cliente_telefono}
            />
            <Campo
              name="cliente_direccion"
              label="Direccion"
              def={pedido.cliente_direccion}
            />
            <div>
              <label className="etiqueta" htmlFor="domiciliario_id">
                Domiciliario
              </label>
              <select
                id="domiciliario_id"
                name="domiciliario_id"
                defaultValue={pedido.domiciliario_id ?? ''}
                className="campo"
              >
                <option value="">Sin asignar</option>
                {domiciliarios.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </div>
            <Campo
              name="valor_domicilio"
              label="Valor domicilio"
              def={String(pedido.valor_domicilio)}
              tipo="number"
            />
          </>
        ) : (
          <Campo
            name="comensales"
            label="Comensales"
            def={String(pedido.comensales ?? '')}
            tipo="number"
          />
        )}

        <Campo
          name="descuento"
          label="Descuento"
          def={String(pedido.descuento)}
          tipo="number"
        />
        <Campo name="cliente_notas" label="Observaciones" def={pedido.cliente_notas} />

        {/* Campos no mostrados se envian vacios; los conservamos aqui. */}
        {!esDomicilio && (
          <>
            <input type="hidden" name="cliente_nombre" value={pedido.cliente_nombre ?? ''} />
            <input
              type="hidden"
              name="cliente_telefono"
              value={pedido.cliente_telefono ?? ''}
            />
            <input
              type="hidden"
              name="cliente_direccion"
              value={pedido.cliente_direccion ?? ''}
            />
            <input
              type="hidden"
              name="domiciliario_id"
              value={pedido.domiciliario_id ?? ''}
            />
            <input type="hidden" name="valor_domicilio" value={pedido.valor_domicilio} />
          </>
        )}
        {esDomicilio && (
          <input type="hidden" name="comensales" value={pedido.comensales ?? ''} />
        )}

        <button type="submit" className="btn-marca w-full">
          Guardar
        </button>
      </form>
    </Modal>
  );
}

function Campo({
  name,
  label,
  def,
  tipo = 'text',
}: {
  name: string;
  label: string;
  def?: string | null;
  tipo?: string;
}) {
  return (
    <div>
      <label className="etiqueta" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={tipo}
        defaultValue={def ?? ''}
        className="campo"
      />
    </div>
  );
}
