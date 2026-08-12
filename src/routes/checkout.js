const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { withImages, COMMISSION_RATE } = require('./products');

const router = express.Router();

async function getListing(id) {
  return db
    .prepare(
      `SELECT listings.*, users.name AS seller_name
       FROM listings JOIN users ON users.id = listings.seller_id
       WHERE listings.id = ?`
    )
    .get(id);
}

function generateOrderNumber() {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return 'ELI-' + Date.now().toString().slice(-6) + '-' + rand;
}

// Paso 1: elegir cantidad -> formulario de datos del comprador
router.get('/checkout/:id', requireAuth, async (req, res, next) => {
  try {
    const listing = await getListing(req.params.id);
    if (!listing) return res.status(404).render('error', { message: 'Prenda no encontrada.' });
    if (listing.seller_id === req.user.id) {
      return res.status(400).render('error', { message: 'No puedes comprar tu propia prenda.' });
    }
    const qty = Math.max(1, Math.min(parseInt(req.query.qty, 10) || 1, listing.stock));
    if (listing.stock <= 0) {
      return res.status(400).render('error', { message: 'Esta prenda ya está agotada.' });
    }
    res.render('checkout', { listing: await withImages(listing), qty, error: null });
  } catch (e) {
    next(e);
  }
});

// Paso 2: guarda el pedido en estado "pendiente_pago" y muestra el QR para pagar
router.post('/checkout/:id', requireAuth, async (req, res, next) => {
  try {
    const listing = await getListing(req.params.id);
    if (!listing) return res.status(404).render('error', { message: 'Prenda no encontrada.' });

    const qty = Math.max(1, parseInt(req.body.qty, 10) || 1);
    const { buyer_name, buyer_phone, buyer_address } = req.body;

    if (!buyer_name || !buyer_phone || !buyer_address) {
      return res.status(400).render('checkout', {
        listing: await withImages(listing),
        qty,
        error: 'Completa tu nombre, teléfono y dirección de entrega.',
      });
    }
    if (qty > listing.stock) {
      return res.status(400).render('checkout', {
        listing: await withImages(listing),
        qty: listing.stock,
        error: 'Ya no hay suficiente stock para esa cantidad. Elige una cantidad menor.',
      });
    }

    const unitPrice = listing.price;
    const totalPrice = +(unitPrice * qty).toFixed(2);
    const commission = +(totalPrice * COMMISSION_RATE).toFixed(2);
    const sellerNet = +(totalPrice - commission).toFixed(2);

    const info = await db
      .prepare(
        `INSERT INTO orders
          (order_number, listing_id, buyer_id, seller_id, quantity, unit_price, total_price,
           commission_rate, commission_amount, seller_net, buyer_name, buyer_phone, buyer_address, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente_pago') RETURNING id`
      )
      .run(
        generateOrderNumber(),
        listing.id,
        req.user.id,
        listing.seller_id,
        qty,
        unitPrice,
        totalPrice,
        COMMISSION_RATE,
        commission,
        sellerNet,
        buyer_name.trim(),
        buyer_phone.trim(),
        buyer_address.trim()
      );

    res.redirect('/checkout/pay/' + info.lastInsertRowid);
  } catch (e) {
    next(e);
  }
});

// Paso 3: pantalla de pago con QR
router.get('/checkout/pay/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
    if (!order || order.buyer_id !== req.user.id) {
      return res.status(404).render('error', { message: 'Pedido no encontrado.' });
    }
    if (order.status === 'pagado') return res.redirect('/receipt/' + order.id);
    const listing = await getListing(order.listing_id);
    res.render('pay', { order, listing });
  } catch (e) {
    next(e);
  }
});

// Paso 4: confirmar pago -> descuenta stock (con transaccion real de Postgres) y genera comprobante
router.post('/checkout/pay/:orderId/confirm', requireAuth, async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1', [req.params.orderId]);
    const order = orderRes.rows[0];
    if (!order || order.buyer_id !== req.user.id) {
      client.release();
      return res.status(404).render('error', { message: 'Pedido no encontrado.' });
    }
    if (order.status === 'pagado') {
      client.release();
      return res.redirect('/receipt/' + order.id);
    }

    const listingRes = await client.query('SELECT * FROM listings WHERE id = $1', [order.listing_id]);
    const listing = listingRes.rows[0];
    if (!listing || listing.stock < order.quantity) {
      client.release();
      return res.status(400).render('error', {
        message: 'Ya no hay suficiente stock disponible para este pedido. Contacta al vendedor.',
      });
    }

    await client.query('BEGIN');
    await client.query(
      "UPDATE orders SET status = 'pagado', paid_at = extract(epoch from now())::bigint WHERE id = $1",
      [order.id]
    );
    const newStock = listing.stock - order.quantity;
    const newStatus = newStock <= 0 ? 'agotado' : 'en_venta';
    await client.query('UPDATE listings SET stock = $1, status = $2 WHERE id = $3', [
      newStock,
      newStatus,
      listing.id,
    ]);
    await client.query('COMMIT');
    client.release();

    res.redirect('/receipt/' + order.id);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    next(e);
  }
});

// Comprobante de compra
router.get('/receipt/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await db
      .prepare(
        `SELECT orders.*, listings.name AS listing_name, users.name AS seller_name
         FROM orders
         JOIN listings ON listings.id = orders.listing_id
         JOIN users ON users.id = orders.seller_id
         WHERE orders.id = ?`
      )
      .get(req.params.orderId);

    if (!order) return res.status(404).render('error', { message: 'Comprobante no encontrado.' });
    const isOwner = order.buyer_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).render('error', { message: 'No tienes permiso para ver este comprobante.' });
    }
    res.render('receipt', { order });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
