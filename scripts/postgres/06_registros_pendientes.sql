-- ==========================================================
-- PROYECTO: BYCAR
-- FASE: Verificación del correo al registrarse (2026-10-02)
--
-- Se corre una sola vez sobre la base existente, después de 05, y ANTES de
-- encender EMAIL_VERIFICATION. Es idempotente y no toca datos existentes.
--
-- Un registro espera acá hasta que la persona ingresa el código que le llegó
-- al correo. Recién entonces se crea en USUARIOS. Si el código vence (5 min)
-- o se equivoca dos veces, la fila se borra: el registro se descarta.
-- El código nunca se guarda: solo su hash (HMAC-SHA256).
-- ==========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS REGISTROS_PENDIENTES (
    ID_REG BIGINT,
    NOMBRE_REG VARCHAR(100) NOT NULL,
    APELLIDO_REG VARCHAR(100) NOT NULL,
    CORREO_REG VARCHAR(150) NOT NULL,
    CONTRASENA_REG VARCHAR(255) NOT NULL,
    CODIGO_HASH_REG VARCHAR(64) NOT NULL,
    INTENTOS_REG INTEGER NOT NULL DEFAULT 0,
    REENVIOS_REG INTEGER NOT NULL DEFAULT 0,
    EXPIRA_REG TIMESTAMPTZ NOT NULL,
    ULTIMO_ENVIO_REG TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FECHA_CREACION_REG TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PK_REGISTROS_PENDIENTES PRIMARY KEY(ID_REG),
    -- Un solo registro pendiente por correo (también sirve de índice para buscarlo)
    CONSTRAINT UQ_REGISTROS_PENDIENTES_CORREO UNIQUE(CORREO_REG)
);

-- La limpieza de pendientes vencidos filtra por vencimiento
CREATE INDEX IF NOT EXISTS IDX_REGISTROS_PENDIENTES_EXPIRA ON REGISTROS_PENDIENTES (EXPIRA_REG);

-- Igual que las demás tablas: sin políticas, la API REST de Supabase no la expone
ALTER TABLE REGISTROS_PENDIENTES ENABLE ROW LEVEL SECURITY;

COMMIT;
