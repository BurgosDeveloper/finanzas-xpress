# Finanzas Xpress

Web sencilla para llevar los **ingresos y egresos** de la empresa. Hecha para usarse en el celular.

- **Tesorero** (`tesorero`): único que puede agregar, editar y borrar movimientos y cambiar las tasas. Solo puede tener **una sesión abierta a la vez**.
- **Supervisor** (`supervisor`): solo ve la información, en vivo. Puede entrar desde **varios dispositivos a la vez**.

Las claves iniciales se crean la primera vez que arranca la web y se guardan cifradas (hash) en la base de datos.
Cámbialas en cuanto puedas con las variables `TESORERO_PASSWORD` y `SUPERVISOR_PASSWORD` **antes del primer arranque**, o directamente en la base de datos.

## Tecnología

React + Vite (web) · Netlify Functions (servidor) · Neon Postgres (base de datos) · Zod (validación) · Ionicons (iconos).

```
src/        la web
shared/     validaciones zod (las usan la web y el servidor)
server/     base de datos y sesiones
netlify/functions/api.mjs   todas las rutas /api
```

## Publicar en Netlify

1. En Netlify: **Add new site → Import an existing project → GitHub** y elige este repositorio.
   (Netlify detecta `netlify.toml`: compila con `npm run build` y publica `dist`.)
2. Ve a **Site configuration → Environment variables** y agrega **una** de estas dos opciones:
   - **Opción A (recomendada):** `DATABASE_URL` = `postgresql://USUARIO:CLAVE@HOST/BASE?sslmode=require`
   - **Opción B:** las cuatro variables `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` con los datos de Neon.
3. Marca la clave (`DATABASE_URL` o `PGPASSWORD`) como **Secret** y vuelve a desplegar (**Deploys → Trigger deploy**).
4. Las tablas y los dos usuarios se crean solos la primera vez que alguien abre la web.

> Nunca subas credenciales al repositorio. El archivo `.env` está ignorado por git.

## Probar en tu computadora

```bash
npm install
cp .env.example .env     # y escribe tu DATABASE_URL
npm run dev              # usa Netlify CLI; abre http://localhost:8888
```

> Si tu PC ya tiene variables `PG*` del sistema (por ejemplo `PGHOST=localhost`), usa `DATABASE_URL`: tiene prioridad.

## Cómo funciona lo importante

- **Tiempo real:** la web consulta cada 5 segundos (solo con la pantalla visible) y solo descarga datos si algo cambió.
- **Sesión única del tesorero:** si entra desde otro dispositivo, se le ofrece cerrar la sesión anterior; la anterior se cierra sola.
- **Monedas:** dólares (US$), pesos (COP) y bolívares (Bs). Todo se suma convirtiendo con las tasas actuales que pone el tesorero.
- **Seguridad:** claves con scrypt, sesión en cookie `HttpOnly`/`SameSite=Strict`, bloqueo tras 8 intentos fallidos, validación con zod también en el servidor, y solo el tesorero puede escribir.
