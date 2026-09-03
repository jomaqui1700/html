# Migración de Ganadera San Ramón a Neon

## Objetivo
Eliminar la dependencia de Supabase y mantener:
- Vercel para despliegue
- GitHub para código
- Neon PostgreSQL para datos
- Autenticación propia con roles `admin` y `viewer`

## Estado actual
El esquema compatible con Neon está en `db/neon_schema.sql`.

## Variables previstas en Vercel
- `DATABASE_URL` = cadena de conexión PostgreSQL de Neon
- `AUTH_SECRET` = secreto aleatorio largo para firmar sesiones

## Dependencias previstas
- `@neondatabase/serverless`
- `bcryptjs`
- `jose`

## Flujo de autenticación nuevo
1. El primer administrador se crea una sola vez desde una pantalla inicial.
2. La contraseña se guarda únicamente como hash bcrypt en la tabla `users`.
3. El login crea una cookie de sesión HTTP-only firmada.
4. El rol se consulta en la base de datos.
5. `admin` puede crear/modificar; `viewer` solo consulta.
6. No se requiere correo de confirmación para el administrador inicial.

## Orden de migración
1. Crear proyecto/base de datos en Neon.
2. Ejecutar `db/neon_schema.sql`.
3. Configurar `DATABASE_URL` y `AUTH_SECRET` en Vercel.
4. Instalar dependencias Neon/autenticación.
5. Sustituir `lib/supabase.js` por acceso PostgreSQL.
6. Crear rutas `/api/auth/*` para login, logout y administrador inicial.
7. Adaptar la página principal a la nueva sesión.
8. Conectar Fincas.
9. Conectar Café, Ganado, Inventarios, Gastos y Reportes.
10. Validar en producción.
11. Solo después de validar, retirar Supabase.

## Importante
No eliminar el proyecto Supabase mientras la aplicación nueva no haya sido validada en producción. Se utiliza temporalmente como respaldo de la estructura previa.
