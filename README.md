# Eli Store — Tienda de ropa

Aplicación real con backend, base de datos permanente, login, stock por producto, pago con QR y comprobantes.

## Qué incluye

- **Marca**: Eli Store, con paleta de colores rosa
- **Backend**: Node.js + Express
- **Base de datos permanente**: PostgreSQL (a través de Neon, gratis) — ya NO se borra cuando el servidor se reinicia o duerme
- **Fotos permanentes**: Cloudinary (gratis) — si no se configura, se guardan en el servidor como respaldo (pero esas sí se pierden en Render gratis)
- **Login real**: contraseñas encriptadas (bcrypt) + sesión con JWT en cookie
- **Roles**: comprador, vendedor, admin
- **Stock por producto**: cada prenda tiene unidades disponibles; el comprador elige cuántas quiere
- **Flujo de compra**: ver producto → elegir cantidad → formulario con datos de entrega → pantalla de pago con QR → comprobante de compra
- **Panel de administrador**: agregar productos, eliminar productos, marcar como agotado, ver ventas y comisión total, gestionar roles de usuarios

## Antes de arrancar: necesitas 2 cuentas gratis

Esta versión requiere una base de datos real. Sin esto, la app no arranca.

### 1. Crea tu base de datos gratis en Neon

1. Ve a [neon.tech](https://neon.tech) y crea una cuenta gratis
2. Crea un proyecto nuevo (cualquier nombre)
3. En el dashboard, busca "Connection string" y cópiala completa (empieza con `postgresql://...`)
4. Pégala en tu archivo `.env` en la variable `DATABASE_URL`

### 2. (Recomendado) Crea tu cuenta gratis en Cloudinary, para que las fotos no se pierdan

1. Ve a [cloudinary.com](https://cloudinary.com) y crea una cuenta gratis
2. En el Dashboard, busca "API Environment variable" — es una línea que empieza con `CLOUDINARY_URL=cloudinary://...`
3. Copia esa URL completa (sin la parte `CLOUDINARY_URL=`) y pégala en tu archivo `.env` en la variable `CLOUDINARY_URL`

Si no configuras Cloudinary, la app igual funciona: las fotos se guardan en el servidor como antes, con la misma limitación de siempre (se pierden si el servidor se reinicia en Render gratis).

## Cómo correrlo en tu computadora

1. Instala [Node.js](https://nodejs.org) si no lo tienes.
2. Abre una terminal en esta carpeta y ejecuta:

```bash
npm install
cp .env.example .env
```

3. Edita `.env` y completa `JWT_SECRET`, `DATABASE_URL` (obligatoria) y `CLOUDINARY_URL` (opcional).
4. Ejecuta:

```bash
npm start
```

5. Abre `http://localhost:3000` en tu navegador.

## Crear tu primer usuario administrador

```bash
node src/seed-admin.js "Tu Nombre" tucorreo@ejemplo.com tuContraseña123
```

Si ya tienes una cuenta con ese correo, este comando simplemente la vuelve admin.

## Cómo funciona el pago

El pago se hace escaneando un código QR (Yolo Pago / Banco Ganadero). El comprador transfiere desde su app bancaria y toca "Ya pagué" para confirmar. En ese momento se genera el comprobante y se descuenta el stock.

Para cambiar el código QR:
1. Reemplaza `public/images/qr-pago.jpg` con tu propio código QR (mismo nombre de archivo)
2. Edita el nombre de la cuenta en `views/pay.ejs`

## Subir esto a internet (Render)

1. Sube el código a GitHub (sin la carpeta `node_modules`, sin `.env`)
2. Crea una cuenta gratis en [Render.com](https://render.com) y conéctala con GitHub
3. Crea un "Web Service" apuntando a tu repositorio:
   - Build command: `npm install`
   - Start command: `npm start`
4. Agrega estas variables de entorno en el panel de Render:
   - `JWT_SECRET` (cualquier texto largo y aleatorio)
   - `DATABASE_URL` (la de tu proyecto de Neon)
   - `CLOUDINARY_URL` (la de tu cuenta de Cloudinary, si la configuraste)
5. Deploy

Con esto, tus usuarios, productos y fotos ya **no se van a borrar** aunque el servicio gratuito de Render se duerma y despierte — porque ahora viven en Neon y Cloudinary, no en el propio servidor.

## Estructura del proyecto

```
eli-store/
  src/
    server.js           # arranca la app
    db.js                # conexión a Postgres y esquema de tablas
    middleware/auth.js    # login, sesiones, permisos por rol
    routes/
      auth.js              # registro / login / logout
      products.js           # catálogo, publicar prendas, subir fotos (Cloudinary o local)
      checkout.js            # cantidad, datos de entrega, pago QR, comprobante
      profile.js               # panel de "mi cuenta"
      admin.js                  # panel de administrador
  views/                # páginas (EJS)
  public/
    css/style.css         # estilos (paleta rosa)
    images/qr-pago.jpg     # código QR de pago
  uploads/                # fotos guardadas localmente (solo si NO configuras Cloudinary)
```

## Comisión

La tasa de comisión (10%) está definida en `src/routes/products.js` como `COMMISSION_RATE`.
