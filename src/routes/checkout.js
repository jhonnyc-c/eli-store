const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { withImages, COMMISSION_RATE } = require('./products');

const router = express.Router();

function getListing(id) {
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

// Paso 1: elegir cantidad en la ficha de producto -> formulario de datos del comprador
router.get('/checkout/:id', requireAuth, (req, res) => {
  const listing = getListing(req.params.id);
  if (!listing) return res.status(404).render('error', { message: 'Prenda no encontrada.' });
  if (listing.seller_id === req.user.id) {
    return res.status(400).render('error', { message: 'No puedes comprar tu propia prenda.' });
  }
  const qty = Math.max(1, Math.min(parseInt(req.query.qty, 10) || 1, listing.stock));
  if (listing.stock <= 0) {
    return res.status(400).render('error', { message: 'Esta prenda ya está agotada.' });
  }
  res.render('checkout', { listing: withImages(listing), qty, error: null });
});

// Paso 2: guarda el pedido en estado "pendiente_pago" y muestra el QR para pagar
router.post('/checkout/:id', requireAuth, (req, res) => {
  const listing = getListing(req.params.id);
  if (!listing) return res.status(404).render('error', { message: 'Prenda no encontrada.' });

  const qty = Math.max(1, parseInt(req.body.qty, 10) || 1);
  const { buyer_name, buyer_phone, buyer_address } = req.body;

  if (!buyer_name || !buyer_phone || !buyer_address) {
    return res.status(400).render('checkout', {
      listing: withImages(listing),
      qty,
      error: 'Completa tu nombre, teléfono y dirección de entrega.',
    });
  }
  if (qty > listing.stock) {
    return res.status(400).render('checkout', {
      listing: withImages(listing),
      qty: listing.stock,
      error: 'Ya no hay suficiente stock para esa cantidad. Elige una cantidad menor.',
    });
  }

  const unitPrice = listing.price;
  const totalPrice = +(unitPrice * qty).toFixed(2);
  const commission = +(totalPrice * COMMISSION_RATE).toFixed(2);
  const sellerNet = +(totalPrice - commission).toFixed(2);

  const info = db
    .prepare(
      `INSERT INTO orders
        (order_number, listing_id, buyer_id, seller_id, quantity, unit_price, total_price,
         commission_rate, commission_amount, seller_net, buyer_name, buyer_phone, buyer_address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente_pago')`
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
});

// Paso 3: pantalla de pago con QR
router.get('/checkout/pay/:orderId', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
  if (!order || order.buyer_id !== req.user.id) {
    return res.status(404).render('error', { message: 'Pedido no encontrado.' });
  }
  if (order.status === 'pagado') return res.redirect('/receipt/' + order.id);
  const listing = getListing(order.listing_id);
  res.render('pay', { order, listing });
});

// Paso 4: el comprador confirma que ya pagó -> se descuenta stock y se genera el comprobante
router.post('/checkout/pay/:orderId/confirm', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
  if (!order || order.buyer_id !== req.user.id) {
    return res.status(404).render('error', { message: 'Pedido no encontrado.' });
  }
  if (order.status === 'pagado') return res.redirect('/receipt/' + order.id);

  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(order.listing_id);
  if (!listing || listing.stock < order.quantity) {
    return res.status(400).render('error', {
      message: 'Ya no hay suficiente stock disponible para este pedido. Contacta al vendedor.',
    });
  }

  db.exec('BEGIN');
  try {
    db.prepare("UPDATE orders SET status = 'pagado', paid_at = strftime('%s','now') WHERE id = ?").run(order.id);
    const newStock = listing.stock - order.quantity;
    const newStatus = newStock <= 0 ? 'agotado' : 'en_venta';
    db.prepare('UPDATE listings SET stock = ?, status = ? WHERE id = ?').run(newStock, newStatus, listing.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  res.redirect('/receipt/' + order.id);
});

// Comprobante de compra
router.get('/receipt/:orderId', requireAuth, (req, res) => {
  const order = db
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
});

module.exports = router;
