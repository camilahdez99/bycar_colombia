-- ==========================================================
-- PROYECTO: BYCAR
-- FASE: CREACION DE INDICES
-- DESCRIPCION: Optimización de consultas en la base de datos
-- ==========================================================

-- ==========================================================
-- INDICES TABLA: PERFILES
-- ==========================================================

-- Este índice se crea porque la columna ROLES_ID_ROL
-- es una llave foránea y ayudará a relacionar perfiles
-- con roles de manera más rápida en las consultas.

CREATE INDEX IDX_PERFILES_ROL
ON PERFILES (ROLES_ID_ROL)
TABLESPACE TS_BYCAR;

-- ==========================================================
-- INDICES TABLA: PERMISOS
-- ==========================================================

-- Este índice mejora las búsquedas de permisos
-- asociados a cada menú.

CREATE INDEX IDX_PERMISOS_MENU
ON PERMISOS (MENU_ID_ENU)
TABLESPACE TS_BYCAR;

-- ==========================================================
-- INDICES TABLA: USUARIOS
-- ==========================================================

-- Este índice mejora las búsquedas de usuarios
-- según el perfil que tengan asignado.

CREATE INDEX IDX_USUARIOS_PERFIL
ON USUARIOS (PERFIL_ID_PER)
TABLESPACE TS_BYCAR;

-- NOTA:
-- No se crea índice sobre CORREO_USU porque Oracle
-- ya genera automáticamente un índice UNIQUE.

-- ==========================================================
-- INDICES TABLA: MUNICIPIOS
-- ==========================================================

-- Este índice ayuda a consultar municipios
-- pertenecientes a un departamento específico.

CREATE INDEX IDX_MUNICIPIOS_DEPARTAMENTO
ON MUNICIPIOS (DEPARTAMENTO_ID_DEP)
TABLESPACE TS_BYCAR;

-- ==========================================================
-- INDICES TABLA: VEHICULOS
-- ==========================================================

-- Este índice mejora la búsqueda de vehículos
-- asociados a un conductor.

CREATE INDEX IDX_VEHICULOS_CONDUCTOR
ON VEHICULOS (CONDUCTOR_ID_USU)
TABLESPACE TS_BYCAR;

-- Este índice mejora la relación entre vehículos y marcas.

CREATE INDEX IDX_VEHICULOS_MARCA
ON VEHICULOS (MARCA_ID_MAR)
TABLESPACE TS_BYCAR;

-- ==========================================================
-- INDICES TABLA: VIAJES
-- ==========================================================

-- Este índice mejora las consultas de viajes
-- realizados por un usuario.

CREATE INDEX IDX_VIAJES_USUARIO
ON VIAJES (USUARIOS_ID_USU)
TABLESPACE TS_BYCAR;

-- Este índice mejora las búsquedas por municipio origen.

CREATE INDEX IDX_VIAJES_ORIGEN
ON VIAJES (MUNICIPIO_ORIGEN_ID)
TABLESPACE TS_BYCAR;

-- Este índice mejora las búsquedas por municipio destino.

CREATE INDEX IDX_VIAJES_DESTINO
ON VIAJES (MUNICIPIOS_DESTINO_ID)
TABLESPACE TS_BYCAR;

-- Este índice mejora la búsqueda de viajes
-- asociados a un vehículo.

CREATE INDEX IDX_VIAJES_VEHICULO
ON VIAJES (VEHICULO_PLACA_VEH)
TABLESPACE TS_BYCAR;

-- Este índice mejora consultas según el estado del viaje,
-- por ejemplo disponibles o finalizados.

CREATE INDEX IDX_VIAJES_ESTADO
ON VIAJES (ESTADO_VIA_ID_EST_VIA)
TABLESPACE TS_BYCAR;

-- ==========================================================
-- INDICES TABLA: MENSAJES
-- ==========================================================

-- Este índice mejora las búsquedas de mensajes
-- recibidos por un usuario.

CREATE INDEX IDX_MENSAJES_RECEPTOR
ON MENSAJES (USUARIO_RECEPTOR_ID)
TABLESPACE TS_BYCAR;

-- Este índice mejora las búsquedas de mensajes
-- enviados por un usuario.

CREATE INDEX IDX_MENSAJES_EMISOR
ON MENSAJES (USUARIOS_EMISOR_ID)
TABLESPACE TS_BYCAR;

-- ==========================================================
-- INDICES TABLA: SOLICITUDES
-- ==========================================================

-- Este índice ayuda a consultar solicitudes
-- realizadas por un usuario.

CREATE INDEX IDX_SOLICITUDES_USUARIO
ON SOLICITUDES (USUARIOS_ID_USU)
TABLESPACE TS_BYCAR;

-- Este índice mejora las consultas de solicitudes
-- relacionadas con viajes.

CREATE INDEX IDX_SOLICITUDES_VIAJE
ON SOLICITUDES (VIAJES_ID_VIA)
TABLESPACE TS_BYCAR;

-- Este índice mejora las consultas según el estado
-- de la solicitud.

CREATE INDEX IDX_SOLICITUDES_ESTADO
ON SOLICITUDES (ESTADO_ID_EST)
TABLESPACE TS_BYCAR;

-- ==========================================================
-- INDICES TABLA: GUARDIANES
-- ==========================================================

-- Este índice mejora la búsqueda de guardianes
-- asociados a un viaje.

CREATE INDEX IDX_GUARDIANES_VIAJE
ON GUARDIANES (VIAJES_ID_VIA)
TABLESPACE TS_BYCAR;

-- Este índice ayuda a consultar guardianes
-- según el estado en el que se encuentren.

CREATE INDEX IDX_GUARDIANES_ESTADO
ON GUARDIANES (ESTADO_ID_EST)
TABLESPACE TS_BYCAR;

COMMIT;