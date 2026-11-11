-- ============================================================================
-- Esquema de la base de datos del Sistema de Reservas de Canchas (PostgreSQL)
-- Pensado para Supabase: ejecutar UNA vez en el SQL Editor del proyecto.
-- También lo carga el contenedor local de Postgres (docker-entrypoint-initdb.d).
--
-- Reconstruido a partir de las entidades TypeORM de cada microservicio.
-- Nota de diseño (REST / microservicios): cada dato tiene un único dueño.
--   * Las estadísticas del cliente (no_shows, total_reservas, ultima_reserva)
--     NO se almacenan: se derivan de las reservas (api-turnos).
--   * El estado de pago de la reserva (sena_pagada, pago_completo) NO se almacena:
--     se deriva de los pagos (api-pagos).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos ENUM (en Postgres son tipos propios; se crean una sola vez)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE rol_usuario   AS ENUM ('cliente', 'empleado', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_cliente AS ENUM ('activo', 'suspendido', 'bloqueado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_cancha  AS ENUM ('disponible', 'mantenimiento', 'fuera_servicio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE estado_reserva AS ENUM ('pendiente', 'confirmada', 'cancelada', 'completada', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tipo_pago      AS ENUM ('seña', 'saldo', 'completo', 'devolucion');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE metodo_pago    AS ENUM ('efectivo', 'tarjeta', 'transferencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- usuarios (api-usuarios)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol           rol_usuario  NOT NULL DEFAULT 'cliente',
  created_at    TIMESTAMP    NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- tipos_cliente (api-usuarios) — categorías con descuento asociado
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipos_cliente (
  id                   SERIAL PRIMARY KEY,
  nombre               VARCHAR(50)  NOT NULL UNIQUE,
  descuento_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- clientes (api-usuarios)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
  id              SERIAL PRIMARY KEY,
  usuario_id      INT NULL,
  nombre          VARCHAR(100) NOT NULL,
  apellido        VARCHAR(100) NOT NULL,
  telefono        VARCHAR(20)  NOT NULL UNIQUE,
  email           VARCHAR(150) NULL UNIQUE,
  tipo_cliente_id INT NULL DEFAULT 1,
  estado          estado_cliente NOT NULL DEFAULT 'activo',
  created_at      TIMESTAMP    NOT NULL DEFAULT now(),
  CONSTRAINT fk_clientes_usuario      FOREIGN KEY (usuario_id)      REFERENCES usuarios(id)      ON DELETE SET NULL,
  CONSTRAINT fk_clientes_tipo_cliente FOREIGN KEY (tipo_cliente_id) REFERENCES tipos_cliente(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- canchas (api-canchas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS canchas (
  id              SERIAL PRIMARY KEY,
  nombre          VARCHAR(100)  NOT NULL UNIQUE,
  capacidad       INT           NOT NULL DEFAULT 22,
  precio_por_hora DECIMAL(10,2) NOT NULL,
  descripcion     TEXT NULL,
  -- Barrio/zona (ej. 'Villa Urquiza'). El chatbot filtra por esta columna, no por texto libre.
  zona            VARCHAR(60) NULL,
  -- Mail de la cancha: api-notificaciones le avisa cuando se reserva/confirma/cancela un turno.
  email_contacto  VARCHAR(120) NULL,
  estado          estado_cancha NOT NULL DEFAULT 'disponible',
  -- Nullable: una cancha sin coordenadas simplemente no participa del recomendador por cercanía.
  latitud         DECIMAL(10,7) NULL,
  longitud        DECIMAL(10,7) NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP     NOT NULL DEFAULT now()
);

-- Para bases creadas antes de que existiera `zona` (CREATE TABLE IF NOT EXISTS no la agrega).
ALTER TABLE canchas ADD COLUMN IF NOT EXISTS zona VARCHAR(60) NULL;
ALTER TABLE canchas ADD COLUMN IF NOT EXISTS email_contacto VARCHAR(120) NULL;

-- updated_at automático (equivalente a ON UPDATE CURRENT_TIMESTAMP de MariaDB)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_canchas_updated_at ON canchas;
CREATE TRIGGER trg_canchas_updated_at
  BEFORE UPDATE ON canchas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- reservas (api-turnos)
-- Sin FK a clientes/canchas: pertenecen a otros microservicios (acoplamiento débil).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservas (
  id                 SERIAL PRIMARY KEY,
  cancha_id          INT  NOT NULL,
  cliente_id         INT  NOT NULL,
  fecha              DATE NOT NULL,
  hora_inicio        TIME NOT NULL,
  hora_fin           TIME NOT NULL,
  precio_total       DECIMAL(10,2) NOT NULL,
  descuento_aplicado DECIMAL(5,2)  NOT NULL DEFAULT 0,
  sena_requerida     DECIMAL(10,2) NOT NULL DEFAULT 0,
  estado             estado_reserva NOT NULL DEFAULT 'pendiente',
  observaciones      TEXT NULL,
  fecha_creacion     TIMESTAMP NOT NULL DEFAULT now(),
  fecha_cancelacion  TIMESTAMP NULL,
  razon_cancelacion  TEXT NULL
);

-- Garantía final contra reservas superpuestas (aunque dos requests simultáneas pasen la
-- validación de la app): misma cancha + rango horario que se cruza + reserva activa = rechazo.
-- api-turnos traduce el error 23P01 a un 409. Es idempotente. En una BD ya creada se aplica
-- con database/migrations/002_reservas_sin_solapamiento.sql (scripts/deploy.sh la corre solo;
-- falla si ya existen solapamientos activos: resolverlos antes).
CREATE EXTENSION IF NOT EXISTS btree_gist;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservas_sin_solapamiento') THEN
    ALTER TABLE reservas ADD CONSTRAINT reservas_sin_solapamiento
      EXCLUDE USING gist (
        cancha_id WITH =,
        tsrange(fecha + hora_inicio, fecha + hora_fin) WITH &&
      ) WHERE (estado IN ('pendiente', 'confirmada'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reservas_cancha_fecha ON reservas (cancha_id, fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_cliente      ON reservas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_estado       ON reservas (estado);

-- ----------------------------------------------------------------------------
-- pagos (api-pagos)
-- Sin FK a reservas: pertenece a otro microservicio (acoplamiento débil).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pagos (
  id            SERIAL PRIMARY KEY,
  reserva_id    INT NOT NULL,
  monto         DECIMAL(10,2) NOT NULL,
  tipo_pago     tipo_pago   NOT NULL,
  metodo_pago   metodo_pago NOT NULL,
  fecha_pago    TIMESTAMP   NOT NULL DEFAULT now(),
  observaciones TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_pagos_reserva ON pagos (reserva_id);

-- ----------------------------------------------------------------------------
-- configuraciones (parámetros de negocio, clave/valor)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuraciones (
  clave       VARCHAR(50) PRIMARY KEY,
  valor       VARCHAR(255) NOT NULL,
  descripcion VARCHAR(255) NULL
);

-- ============================================================================
-- Datos iniciales (seeds)
-- ============================================================================

INSERT INTO tipos_cliente (id, nombre, descuento_porcentaje) VALUES
  (1, 'regular',   0),
  (2, 'frecuente', 10),
  (3, 'vip',       20)
ON CONFLICT (id) DO NOTHING;

-- Mantener la secuencia de tipos_cliente alineada tras los inserts con id explícito
SELECT setval(pg_get_serial_sequence('tipos_cliente', 'id'), GREATEST((SELECT MAX(id) FROM tipos_cliente), 1));

INSERT INTO configuraciones (clave, valor, descripcion) VALUES
  ('sena_porcentaje',       '30', 'Porcentaje de seña requerido sobre el precio total'),
  ('max_no_shows_bloqueo',  '3',  'Cantidad de no-shows que bloquea automáticamente a un cliente'),
  ('horas_anticipacion_min','2',  'Horas mínimas de anticipación para reservar'),
  ('duracion_maxima_horas', '3',  'Duración máxima de una reserva en horas')
ON CONFLICT (clave) DO NOTHING;

-- Usuarios admin de prueba — login: admin@canchas.com / Admin123, admin@admin.com / Admin123
INSERT INTO usuarios (email, password_hash, rol) VALUES
  ('admin@canchas.com', '$2a$10$2lq8AVakRzeHBPkqqm0IWOnYJUso7rhxMyAycVckznW3HTAozFPha', 'admin'),
  ('admin@admin.com',   '$2a$10$2lq8AVakRzeHBPkqqm0IWOnYJUso7rhxMyAycVckznW3HTAozFPha', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO canchas (nombre, capacidad, precio_por_hora, descripcion, latitud, longitud) VALUES
  ('Cancha 1 - Fútbol 11', 22, 25000.00, 'Césped sintético, iluminación LED', -32.9468, -60.6393),
  ('Cancha 2 - Fútbol 7',  14, 18000.00, 'Césped sintético techado', -32.9612, -60.6505),
  ('Cancha 3 - Fútbol 5',  10, 14000.00, 'Césped sintético, ideal para grupos chicos', -32.9755, -60.6389),
  -- Canchas de Capital Federal (Caballito, Villa Urquiza, Chacarita/Colegiales) para
  -- probar el recomendador por cercanía. Nombres y direcciones de referencia tomados de
  -- complejos reales de la zona; coordenadas aproximadas (no geocodificación exacta) y
  -- precio/descripción son de ejemplo, igual que las 3 canchas de arriba.
  ('Caballito Norte',            14, 19000.00, 'Fútbol 7, césped sintético — Av. Avellaneda 1423, Caballito', -34.6183, -58.4398),
  ('Escuela de Fútbol Caballito', 10, 15000.00, 'Fútbol 5, techada — Senillosa 824, Caballito', -34.6188, -58.4378),
  ('El Andén Caballito',          10, 16000.00, 'Fútbol 5, mismo predio con canchas de tenis y pádel — Caballito', -34.6165, -58.4415),
  ('Urquiza Fútbol',              10, 17000.00, 'Fútbol 5, 8 canchas — Roosevelt 5170, Villa Urquiza', -34.5682, -58.5012),
  ('Argentina 2000',              10, 15500.00, 'Fútbol 5 — Nahuel Huapi 5891, Villa Urquiza', -34.5732, -58.5055),
  ('El Campito Villa Urquiza',    14, 18500.00, 'Fútbol 7, césped sintético — Olazábal 5247, Villa Urquiza', -34.5766, -58.4992),
  ('Círculo Penacho Azul',        10, 16500.00, 'Fútbol 5, club de barrio — Tamborini 5676, Villa Urquiza', -34.5717, -58.5042),
  ('Lacroze & Thomas',            14, 20000.00, 'Fútbol 7, techada, piso de goma — Av. Lacroze 3547, Chacarita', -34.5877, -58.4538),
  ('Complejo Chacarita',          10, 17500.00, 'Fútbol 5, alquiler por hora — zona Chacarita', -34.5858, -58.4552),
  ('Cancha Freire Colegiales',    10, 18000.00, 'Fútbol 5, techada — Gral. Ramón Freire 761, Colegiales', -34.5747, -58.4472)
ON CONFLICT (nombre) DO NOTHING;

-- Zona de las canchas de ejemplo (idempotente: solo completa las que no la tienen).
UPDATE canchas SET zona = 'Caballito'     WHERE zona IS NULL AND descripcion ILIKE '%Caballito%';
UPDATE canchas SET zona = 'Villa Urquiza' WHERE zona IS NULL AND descripcion ILIKE '%Villa Urquiza%';
UPDATE canchas SET zona = 'Chacarita'     WHERE zona IS NULL AND descripcion ILIKE '%Chacarita%';
UPDATE canchas SET zona = 'Colegiales'    WHERE zona IS NULL AND descripcion ILIKE '%Colegiales%';
