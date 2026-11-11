-- Garantía final contra reservas superpuestas (ver database/schema.sql).
-- Si ya existen reservas activas (pendiente/confirmada) que se pisan, esta migración falla:
-- resolverlas (cancelar una de cada par) y volver a desplegar.
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
