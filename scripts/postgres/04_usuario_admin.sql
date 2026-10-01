-- ==========================================================
-- PROYECTO: BYCAR
-- FASE: Usuario administrador inicial (opcional)
-- ORIGEN: bloque "2.1 USUARIO ADMINISTRATIVO" de scripts/insercion_data_DML.txt.
--
-- ⚠️ Crea el admin con la misma contraseña conocida que tenía el seed de Oracle
-- (BUGS S5), guardada en texto plano. Antes de correrlo, cambiá 'admin' por una
-- contraseña fuerte, y no la subas al repositorio. Correr después de 03_datos_iniciales.sql.
-- ==========================================================

INSERT INTO USUARIOS (ID_USU, NOMBRE_USU, APELLIDO_USU, CORREO_USU, CONTRASENA_USU, PERFIL_ID_PER) VALUES (1, 'Camila', 'Hernandez', 'admin@bycar.co', 'admin', 1);
