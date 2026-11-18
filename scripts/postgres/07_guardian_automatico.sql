-- ==========================================================
-- PROYECTO: BYCAR
-- FASE: Guardián automático y avisos por correo (2026-11-18)
--
-- Se corre una sola vez sobre la base existente, después de 01 a 06, y ANTES de
-- desplegar el código que usa estas columnas. Es idempotente: correrlo dos veces
-- no rompe nada. No borra datos.
--
-- 1. SOLICITUDES guarda el guardián que el pasajero elige de antemano (un usuario
--    de Bycar) y el tiempo estimado. Cuando el conductor inicia el viaje, el
--    guardián de cada pasajero aceptado se crea solo.
-- 2. GUARDIANES registra cuándo se le avisó al contacto por correo que el viaje
--    empezó y cuándo se le envió la alerta, para no repetir los correos.
-- ==========================================================

-- Todo o nada: si algo falla, no queda aplicado a medias
BEGIN;

-- ----------------------------------------------------------
-- SOLICITUDES: guardián elegido de antemano
-- ----------------------------------------------------------

ALTER TABLE SOLICITUDES
    ADD COLUMN IF NOT EXISTS CONTACTO_GUARDIAN_ID BIGINT,
    ADD COLUMN IF NOT EXISTS TIEMPO_GUARDIAN_SOL INTEGER;

DO $$
BEGIN
    -- Si el contacto borra su cuenta, la solicitud queda sin guardián (no se borra)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_solicitudes_contacto_guardian') THEN
        ALTER TABLE SOLICITUDES ADD CONSTRAINT FK_SOLICITUDES_CONTACTO_GUARDIAN
            FOREIGN KEY (CONTACTO_GUARDIAN_ID) REFERENCES USUARIOS (ID_USU) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tiempo_guardian_sol') THEN
        ALTER TABLE SOLICITUDES ADD CONSTRAINT CK_TIEMPO_GUARDIAN_SOL
            CHECK (TIEMPO_GUARDIAN_SOL IS NULL OR TIEMPO_GUARDIAN_SOL > 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS IDX_SOLICITUDES_CONTACTO_GUARDIAN ON SOLICITUDES (CONTACTO_GUARDIAN_ID);

-- ----------------------------------------------------------
-- GUARDIANES: avisos por correo al contacto
-- ----------------------------------------------------------

ALTER TABLE GUARDIANES
    ADD COLUMN IF NOT EXISTS NOTIFICADO_INICIO_GUA TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS NOTIFICADO_ALERTA_GUA TIMESTAMPTZ;

COMMIT;
