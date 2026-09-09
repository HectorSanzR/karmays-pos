-- Esquema del POS en Postgres (Supabase).
-- Se corre una sola vez con: npm run db:esquema
-- Es idempotente: se puede volver a correr sin romper lo que ya existe.
--
-- Las fechas se guardan como texto ISO (2026-09-09T17:36:07.909Z), igual que
-- antes, para que la hora no dependa de la zona horaria del servidor.
-- La plata siempre son pesos enteros: nada de decimales.

CREATE TABLE IF NOT EXISTS categorias (
  id     integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre text NOT NULL UNIQUE,
  orden  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS productos (
  id           integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  categoria_id integer REFERENCES categorias(id),
  nombre       text NOT NULL,
  descripcion  text,
  precio       integer NOT NULL,
  activo       integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ingredientes (
  id     integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS producto_ingredientes (
  producto_id    integer NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  ingrediente_id integer NOT NULL REFERENCES ingredientes(id) ON DELETE CASCADE,
  removible      integer NOT NULL DEFAULT 1,
  PRIMARY KEY (producto_id, ingrediente_id)
);

CREATE TABLE IF NOT EXISTS mesas (
  id        integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre    text NOT NULL UNIQUE,
  zona      text NOT NULL DEFAULT 'Salon',
  capacidad integer NOT NULL DEFAULT 4
);

CREATE TABLE IF NOT EXISTS domiciliarios (
  id       integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre   text NOT NULL UNIQUE,
  telefono text,
  activo   integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS usuarios (
  id              integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre          text NOT NULL,
  rol             text NOT NULL,
  codigo          text NOT NULL UNIQUE,
  telefono        text,
  domiciliario_id integer REFERENCES domiciliarios(id),
  activo          integer NOT NULL DEFAULT 1,
  creado_en       text NOT NULL
);

CREATE TABLE IF NOT EXISTS sesiones (
  token      text PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creada_en  text NOT NULL
);

-- Expuesto a internet, un codigo de 4 numeros se adivina probando. Aqui queda
-- el rastro de cada intento fallido para poder frenar a quien insiste.
CREATE TABLE IF NOT EXISTS intentos (
  id        integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  origen    text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_intentos ON intentos (origen, creado_en DESC);

CREATE TABLE IF NOT EXISTS caja_sesiones (
  id           integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  base         integer NOT NULL DEFAULT 0,
  abierta_en   text NOT NULL,
  cerrada_en   text,
  conteo_final integer,
  notas        text
);

CREATE TABLE IF NOT EXISTS pedidos (
  id                integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tipo              text NOT NULL,
  estado            text NOT NULL DEFAULT 'abierto',
  mesa_id           integer REFERENCES mesas(id),
  comensales        integer,
  cliente_nombre    text,
  cliente_telefono  text,
  cliente_direccion text,
  cliente_notas     text,
  repartidor        text,
  domiciliario_id   integer REFERENCES domiciliarios(id),
  valor_domicilio   integer NOT NULL DEFAULT 0,
  descuento         integer NOT NULL DEFAULT 0,
  propina           integer NOT NULL DEFAULT 0,
  caja_sesion_id    integer REFERENCES caja_sesiones(id),
  usuario_id        integer REFERENCES usuarios(id),
  creado_en         text NOT NULL,
  cerrado_en        text
);

CREATE TABLE IF NOT EXISTS pedido_items (
  id          integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pedido_id   integer NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id integer REFERENCES productos(id),
  nombre      text NOT NULL,
  precio_unit integer NOT NULL,
  cantidad    integer NOT NULL DEFAULT 1,
  notas       text,
  estado      text NOT NULL DEFAULT 'pendiente',
  creado_en   text NOT NULL
);

CREATE TABLE IF NOT EXISTS pagos (
  id             integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pedido_id      integer NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  metodo         text NOT NULL,
  monto          integer NOT NULL,
  recibido       integer,
  cambio         integer,
  referencia     text,
  caja_sesion_id integer REFERENCES caja_sesiones(id),
  usuario_id     integer REFERENCES usuarios(id),
  creado_en      text NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_pedidos_estado ON pedidos (estado);
CREATE INDEX IF NOT EXISTS ix_pedidos_domi   ON pedidos (domiciliario_id, estado);
CREATE INDEX IF NOT EXISTS ix_pedidos_mesa   ON pedidos (mesa_id, estado);
CREATE INDEX IF NOT EXISTS ix_pedidos_caja   ON pedidos (caja_sesion_id);
CREATE INDEX IF NOT EXISTS ix_items_pedido   ON pedido_items (pedido_id);
CREATE INDEX IF NOT EXISTS ix_pagos_pedido   ON pagos (pedido_id);
CREATE INDEX IF NOT EXISTS ix_pagos_caja     ON pagos (caja_sesion_id);

-- Un salon de arranque, solo si no hay ninguna mesa todavia. Se renombran, se
-- agregan o se quitan segun como sea el local de verdad.
INSERT INTO mesas (nombre, zona, capacidad)
SELECT * FROM (VALUES
  ('Mesa 1', 'Salon', 4),
  ('Mesa 2', 'Salon', 4),
  ('Mesa 3', 'Salon', 4),
  ('Mesa 4', 'Salon', 4),
  ('Mesa 5', 'Salon', 4),
  ('Mesa 6', 'Salon', 4),
  ('Mesa 7', 'Salon', 6),
  ('Mesa 8', 'Salon', 6),
  ('Terraza 1', 'Terraza', 4),
  ('Terraza 2', 'Terraza', 4),
  ('Terraza 3', 'Terraza', 4),
  ('Terraza 4', 'Terraza', 4),
  ('Barra 1', 'Barra', 2),
  ('Barra 2', 'Barra', 2)
) AS nuevas(nombre, zona, capacidad)
WHERE NOT EXISTS (SELECT 1 FROM mesas);

-- Solo aplica en Supabase: alli la base queda ademas detras de una API publica
-- y sin esto la llave anonima alcanzaria para leer las ventas. El POS entra
-- con la contraseña del proyecto y no se ve afectado. En Neon o en cualquier
-- Postgres sin API publica no existe el rol 'anon' y este bloque no hace nada.
DO $$
DECLARE t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    FOREACH t IN ARRAY ARRAY[
      'categorias', 'productos', 'ingredientes', 'producto_ingredientes',
      'mesas', 'domiciliarios', 'usuarios', 'sesiones', 'intentos',
      'caja_sesiones', 'pedidos', 'pedido_items', 'pagos'
    ] LOOP
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
  END IF;
END $$;
