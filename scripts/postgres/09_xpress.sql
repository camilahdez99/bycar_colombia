-- ==========================================================
-- PROYECTO: BYCAR
-- FASE: Xpress, encomiendas dentro de un viaje (2026-11-18)
--
-- Se corre una sola vez sobre la base existente, después de 01 a 07, y ANTES de
-- desplegar el código de /api/xpress. Es idempotente: correrlo dos veces no
-- rompe nada. No borra datos. (Una base nueva ya trae todo esto por 01, 02 y 03.)
--
-- 1. ESTADOS_XPRESS: catálogo de estados de una encomienda.
-- 2. CARGAS: la encomienda. La manda un usuario (emisor) a otro usuario de Bycar
--    (receptor) dentro de un viaje; el conductor del viaje la gestiona.
--    Cancelar no borra la fila: pasa al estado "Cancelada".
-- 3. Menú "Xpress" (/xpress) y su permiso para los usuarios que ya existen
--    (los nuevos lo reciben al registrarse, que les da todos los menús).
-- ==========================================================

-- Todo o nada: si algo falla, no queda aplicado a medias
BEGIN;

-- ----------------------------------------------------------
-- ESTADOS_XPRESS
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS ESTADOS_XPRESS (
    ID_EST_XP BIGINT,
    ESTADO_EST_XP VARCHAR(15),
    CONSTRAINT PK_ESTADO_XPRESS PRIMARY KEY(ID_EST_XP),
    CONSTRAINT NN_ESTADO_EST_XP
        CHECK(ESTADO_EST_XP IS NOT NULL)
);

INSERT INTO ESTADOS_XPRESS (ID_EST_XP, ESTADO_EST_XP) VALUES (1, 'Pendiente') ON CONFLICT DO NOTHING;
INSERT INTO ESTADOS_XPRESS (ID_EST_XP, ESTADO_EST_XP) VALUES (2, 'Aceptada') ON CONFLICT DO NOTHING;
INSERT INTO ESTADOS_XPRESS (ID_EST_XP, ESTADO_EST_XP) VALUES (3, 'Rechazada') ON CONFLICT DO NOTHING;
INSERT INTO ESTADOS_XPRESS (ID_EST_XP, ESTADO_EST_XP) VALUES (4, 'En camino') ON CONFLICT DO NOTHING;
INSERT INTO ESTADOS_XPRESS (ID_EST_XP, ESTADO_EST_XP) VALUES (5, 'Entregada') ON CONFLICT DO NOTHING;
INSERT INTO ESTADOS_XPRESS (ID_EST_XP, ESTADO_EST_XP) VALUES (6, 'Cancelada') ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------
-- CARGAS
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS CARGAS (
    ID_XP BIGINT,
    DESCRIPCION_XP VARCHAR(300) NOT NULL,
    PESO_XP NUMERIC,
    USUARIO_EMISOR_US BIGINT NOT NULL,
    USUARIO_RECEPTOR_US BIGINT NOT NULL,
    VIAJE_ID BIGINT NOT NULL,
    ESTADO_ID_EST_XP BIGINT NOT NULL DEFAULT 1,
    FECHA_CREACION_XP TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PK_CARGAS PRIMARY KEY(ID_XP),
    CONSTRAINT CK_CARGAS_PESO CHECK(PESO_XP IS NULL OR PESO_XP > 0)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cargas_emisor') THEN
        ALTER TABLE CARGAS ADD CONSTRAINT FK_CARGAS_EMISOR
            FOREIGN KEY (USUARIO_EMISOR_US) REFERENCES USUARIOS (ID_USU) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cargas_receptor') THEN
        ALTER TABLE CARGAS ADD CONSTRAINT FK_CARGAS_RECEPTOR
            FOREIGN KEY (USUARIO_RECEPTOR_US) REFERENCES USUARIOS (ID_USU) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cargas_viaje') THEN
        ALTER TABLE CARGAS ADD CONSTRAINT FK_CARGAS_VIAJE
            FOREIGN KEY (VIAJE_ID) REFERENCES VIAJES (ID_VIA) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cargas_estado') THEN
        ALTER TABLE CARGAS ADD CONSTRAINT FK_CARGAS_ESTADO
            FOREIGN KEY (ESTADO_ID_EST_XP) REFERENCES ESTADOS_XPRESS (ID_EST_XP) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS IDX_CARGAS_EMISOR ON CARGAS (USUARIO_EMISOR_US);
CREATE INDEX IF NOT EXISTS IDX_CARGAS_RECEPTOR ON CARGAS (USUARIO_RECEPTOR_US);
CREATE INDEX IF NOT EXISTS IDX_CARGAS_VIAJE ON CARGAS (VIAJE_ID);
CREATE INDEX IF NOT EXISTS IDX_CARGAS_ESTADO ON CARGAS (ESTADO_ID_EST_XP);

-- Igual que las demás tablas: sin políticas, la API REST de Supabase no las expone
ALTER TABLE ESTADOS_XPRESS ENABLE ROW LEVEL SECURITY;
ALTER TABLE CARGAS ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------
-- Menú "Xpress"
-- ----------------------------------------------------------

INSERT INTO MENUS (ID_ENU, CAMPO_ENU, URL_ENU, MENU_ID_ENU)
VALUES (8, 'Xpress', '/xpress', NULL)
ON CONFLICT DO NOTHING;

-- Los usuarios existentes reciben el permiso (hoy todos tienen todos los menús)
INSERT INTO PERMISOS (USUARIO_ID_USU, MENU_ID_ENU)
SELECT u.ID_USU, 8 FROM USUARIOS u
ON CONFLICT DO NOTHING;

COMMIT;
