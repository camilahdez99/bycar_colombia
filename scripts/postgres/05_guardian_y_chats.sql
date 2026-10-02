-- ==========================================================
-- PROYECTO: BYCAR
-- FASE: Guardián con usuarios y chats por evento (2026-10-01)
--
-- Se corre una sola vez sobre la base existente, después de 01 a 04, y ANTES de
-- desplegar el código que usa estas columnas. Es idempotente: correrlo dos veces
-- no rompe nada. No borra datos.
--
-- 1. GUARDIANES guarda quién activó el guardián y el usuario contacto, en vez de
--    deducirlos (el contacto ya tiene que ser un usuario registrado).
-- 2. Cada mensaje queda atado a su chat: una solicitud (pasajero-conductor) o un
--    guardián (usuario protegido-contacto). Antes se filtraban por par de usuarios
--    y dos viajes entre las mismas personas compartían historial (BUGS F4).
--    Los mensajes viejos quedan con las dos columnas en NULL y ya no se muestran.
-- ==========================================================

-- Todo o nada: si algo falla, no queda aplicado a medias
BEGIN;

-- ----------------------------------------------------------
-- GUARDIANES
-- ----------------------------------------------------------

ALTER TABLE GUARDIANES
    ADD COLUMN IF NOT EXISTS USUARIO_ID_USU BIGINT,
    ADD COLUMN IF NOT EXISTS CONTACTO_ID_USU BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_guardian_usuario') THEN
        ALTER TABLE GUARDIANES ADD CONSTRAINT FK_GUARDIAN_USUARIO
            FOREIGN KEY (USUARIO_ID_USU) REFERENCES USUARIOS (ID_USU) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_guardian_contacto') THEN
        ALTER TABLE GUARDIANES ADD CONSTRAINT FK_GUARDIAN_CONTACTO
            FOREIGN KEY (CONTACTO_ID_USU) REFERENCES USUARIOS (ID_USU) ON DELETE CASCADE;
    END IF;
END $$;

-- Guardianes existentes: el contacto se completa por correo. Quién lo activó no se
-- puede saber con certeza (el viaje puede tener varios pasajeros) y queda en NULL.
UPDATE GUARDIANES g
SET CONTACTO_ID_USU = u.ID_USU
FROM USUARIOS u
WHERE g.CONTACTO_ID_USU IS NULL
  AND UPPER(u.CORREO_USU) = UPPER(g.EMAIL_CONFIANZA_GUA);

CREATE INDEX IF NOT EXISTS IDX_GUARDIANES_USUARIO ON GUARDIANES (USUARIO_ID_USU);
CREATE INDEX IF NOT EXISTS IDX_GUARDIANES_CONTACTO ON GUARDIANES (CONTACTO_ID_USU);

-- ----------------------------------------------------------
-- MENSAJES
-- ----------------------------------------------------------

ALTER TABLE MENSAJES
    ADD COLUMN IF NOT EXISTS SOLICITUD_ID_SOL BIGINT,
    ADD COLUMN IF NOT EXISTS GUARDIAN_ID_GUA BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mensajes_solicitud') THEN
        ALTER TABLE MENSAJES ADD CONSTRAINT FK_MENSAJES_SOLICITUD
            FOREIGN KEY (SOLICITUD_ID_SOL) REFERENCES SOLICITUDES (ID_SOL) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mensajes_guardian') THEN
        ALTER TABLE MENSAJES ADD CONSTRAINT FK_MENSAJES_GUARDIAN
            FOREIGN KEY (GUARDIAN_ID_GUA) REFERENCES GUARDIANES (ID_GUA) ON DELETE CASCADE;
    END IF;
    -- Un mensaje pertenece a un solo chat (los viejos, a ninguno)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_mensajes_un_chat') THEN
        ALTER TABLE MENSAJES ADD CONSTRAINT CK_MENSAJES_UN_CHAT
            CHECK (SOLICITUD_ID_SOL IS NULL OR GUARDIAN_ID_GUA IS NULL);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS IDX_MENSAJES_SOLICITUD ON MENSAJES (SOLICITUD_ID_SOL);
CREATE INDEX IF NOT EXISTS IDX_MENSAJES_GUARDIAN ON MENSAJES (GUARDIAN_ID_GUA);

COMMIT;
