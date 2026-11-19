-- ==========================================================
-- PROYECTO: BYCAR
-- FASE: Xpress con ruta propia (2026-11-19)
--
-- Se corre una sola vez sobre la base existente, después de 01 a 09, y ANTES de
-- desplegar el código de /api/xpress que usa estas columnas. Es idempotente:
-- correrlo dos veces no rompe nada. No borra datos. (Una base nueva ya trae todo
-- esto por 01 y 02.)
--
-- Una encomienda ahora puede crearse de dos formas:
--   A) En un viaje existente: VIAJE_ID lleno; el conductor es el dueño del viaje.
--   B) Con ruta propia: VIAJE_ID NULL, con ORIGEN_ID, DESTINO_ID y FECHA_XP. Queda
--      "buscando conductor" (CONDUCTOR_ID_USU NULL) hasta que un conductor la acepta.
--
-- 1. CARGAS.VIAJE_ID pasa a ser anulable.
-- 2. CARGAS gana ORIGEN_ID y DESTINO_ID (municipios), FECHA_XP (opcional) y
--    CONDUCTOR_ID_USU (el conductor que aceptó una carga de ruta propia).
-- 3. CK_CARGAS_MODO: o tiene viaje, o tiene origen y destino (nunca ninguno).
-- ==========================================================

-- Todo o nada: si algo falla, no queda aplicado a medias
BEGIN;

ALTER TABLE CARGAS ALTER COLUMN VIAJE_ID DROP NOT NULL;

ALTER TABLE CARGAS
    ADD COLUMN IF NOT EXISTS ORIGEN_ID BIGINT,
    ADD COLUMN IF NOT EXISTS DESTINO_ID BIGINT,
    ADD COLUMN IF NOT EXISTS FECHA_XP DATE,
    ADD COLUMN IF NOT EXISTS CONDUCTOR_ID_USU BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cargas_origen') THEN
        ALTER TABLE CARGAS ADD CONSTRAINT FK_CARGAS_ORIGEN
            FOREIGN KEY (ORIGEN_ID) REFERENCES MUNICIPIOS (ID_MUN) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cargas_destino') THEN
        ALTER TABLE CARGAS ADD CONSTRAINT FK_CARGAS_DESTINO
            FOREIGN KEY (DESTINO_ID) REFERENCES MUNICIPIOS (ID_MUN) ON DELETE CASCADE;
    END IF;
    -- Si el conductor borra su cuenta, la carga vuelve a quedar sin conductor (no se borra)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cargas_conductor') THEN
        ALTER TABLE CARGAS ADD CONSTRAINT FK_CARGAS_CONDUCTOR
            FOREIGN KEY (CONDUCTOR_ID_USU) REFERENCES USUARIOS (ID_USU) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_cargas_modo') THEN
        ALTER TABLE CARGAS ADD CONSTRAINT CK_CARGAS_MODO
            CHECK (VIAJE_ID IS NOT NULL OR (ORIGEN_ID IS NOT NULL AND DESTINO_ID IS NOT NULL));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS IDX_CARGAS_CONDUCTOR ON CARGAS (CONDUCTOR_ID_USU);
CREATE INDEX IF NOT EXISTS IDX_CARGAS_ORIGEN ON CARGAS (ORIGEN_ID);
CREATE INDEX IF NOT EXISTS IDX_CARGAS_DESTINO ON CARGAS (DESTINO_ID);

COMMIT;
