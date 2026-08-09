# Eli Store — Tienda de ropa

Aplicación real con backend, base de datos, login, stock por producto, pago con QR y comprobantes.

## Qué incluye

- **Marca**: Eli Store, con paleta de colores rosa
- **Backend**: Node.js + Express
- **Base de datos real**: SQLite integrado en Node.js (archivo `percha.db`, se crea solo al arrancar — no requiere instalar nada aparte ni compilar código)
- **Login real**: contraseñas encriptadas (bcrypt) + sesión con JWT en cookie
- **Roles**: comprador, vendedor, admin
- **Fotos reales**: se guardan como archivos en `/uploads`
- **Stock por producto**: cada prenda tiene unidades disponibles; el comprador elige cuántas quiere
- **Flujo de compra**: ver producto → elegir cantidad → formulario con datos de entrega → pantalla de pago con QR → comprobante de compra
- **Panel de administrador**: agregar productos (vía "Vender"), eliminar productos, marcar como agotado, ver ventas y comisión total, gestionar roles de usuarios

## Cómo funciona el pago

El pago se hace por transferencia bancaria escaneando un código QR (Yolo Pago / Banco Ganadero). No hay una pasarela de pago automática conectada: el comprador transfiere el dinero desde su app bancaria y luego toca "Ya pagué" para confirmar. En ese momento se genera el comprobante y se descuenta el stock.

Para cambiar el código QR o los datos de la cuenta que se muestran al comprador:

1. Reemplaza el archivo `public/images/qr-pago.jpg` con tu propio código QR
2. Edita el nombre de la cuenta en `views/pay.ejs` (busca "Jhonny Cordova Cunurana")

## Cómo correrlo en tu computadora

1. Instala [Node.js](https://nodejs.org) (versión **22.5 o más nueva**; se recomienda la más reciente) si no lo tienes.
2. Abre una terminal en esta carpeta y ejecuta:

```bash
npm install
cp .env.example .env
npm start
```

3. Abre `http://localhost:3000` en tu navegador.

## Crear tu primer usuario administrador

Nadie puede registrarse como admin desde el formulario público (por seguridad). Créalo así:

```bash
node src/seed-admin.js "Tu Nombre" tucorreo@ejemplo.com tuContraseña123
```

Si ya tienes una cuenta con ese correo, este comando simplemente la vuelve admin.
Entra en `/admin` una vez que inicies sesión con ese usuario.

## Subir esto a internet (para que otros lo usen)

1. Sube el código a GitHub (necesitas una cuenta gratis en github.com)
2. Crea una cuenta gratis en [Render.com](https://render.com) y conéctala con tu GitHub
3. Crea un "Web Service" apuntando a tu repositorio, con:
   - Build command: `npm install`
   - Start command: `npm start`
4. Agrega tu variable de entorno `JWT_SECRET` en el panel de Render

**Importante sobre los datos:** en el plan gratuito de Render, el archivo `percha.db` y las fotos en `/uploads` viven en el mismo servidor y **se borran cada vez que el servicio se reinicia o se vuelve a desplegar**. Sirve perfecto para que la gente pruebe la app con una URL real, pero no para guardar datos de forma permanente todavía. Para eso, el siguiente paso sería migrar a una base de datos administrada (Postgres) y a un servicio de almacenamiento de imágenes (Cloudinary, S3) — si llegas a ese punto, dime y lo hacemos.

## Estructura del proyecto

```
eli-store/
  src/
    server.js           # arranca la app
    db.js                # base de datos y esquema de tablas
    middleware/auth.js    # login, sesiones, permisos por rol
    routes/
      auth.js              # registro / login / logout
      products.js           # catálogo, publicar prendas, subir fotos
      checkout.js            # cantidad, datos de entrega, pago QR, comprobante
      profile.js               # panel de "mi cuenta"
      admin.js                  # panel de administrador
  views/                # páginas (EJS)
  public/
    css/style.css         # estilos (paleta rosa)
    images/qr-pago.jpg     # código QR de pago
  uploads/                # fotos subidas por los vendedores
  percha.db                # base de datos (se crea sola al arrancar)
```

## Comisión

La tasa de comisión (10%) está definida en `src/routes/products.js` como `COMMISSION_RATE`. Se calcula sobre cada venta y se ve en el panel de administrador.
