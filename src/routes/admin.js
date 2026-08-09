const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/admin', (req, res) => {
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS total_orders,
         COALESCE(SUM(total_price), 0) AS total_gmv,
         COALESCE(SUM(commission_amount), 0) AS total_commission
       FROM orders WHERE status = 'pagado'`
    )
    .get();
  const usersCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const listingsCount = db.prepare('SELECT COUNT(*) AS c FROM listings').get().c;
  const recentOrders = db
    .prepare(
      `SELECT orders.*, l.name AS listing_name, b.name AS buyer_name_acc, s.name AS seller_name
       FROM orders
       JOIN listings l ON l.id = orders.listing_id
       JOIN users b ON b.id = orders.buyer_id
       JOIN users s ON s.id = orders.seller_id
       ORDER BY orders.created_at DESC LIMIT 20`
    )
    .all();

  res.render('admin/dashboard', { totals, usersCount, listingsCount, recentOrders });
});

router.get('/admin/users', (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC').all();
  res.render('admin/users', { users });
});

router.post('/admin/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['comprador', 'vendedor', 'admin'].includes(role)) return res.redirect('/admin/users');
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.redirect('/admin/users');
});

router.get('/admin/products', (req, res) => {
  const listings = db
    .prepare(
      `SELECT listings.*, users.name AS seller_name
       FROM listings JOIN users ON users.id = listings.seller_id
       ORDER BY listings.created_at DESC`
    )
    .all();
  res.render('admin/products', { listings });
});

router.post('/admin/listings/:id/delete', (req, res) => {
  try {
    db.prepare('DELETE FROM listings WHERE id = ?').run(req.params.id);
  } catch (e) {
    return res.status(400).render('error', {
      message: 'No se puede eliminar esta prenda porque ya tiene compras registradas (se perderían los comprobantes). Puedes marcarla como agotada en su lugar.',
    });
  }
  res.redirect('/admin/products');
});

router.post('/admin/listings/:id/mark-out-of-stock', (req, res) => {
  db.prepare("UPDATE listings SET stock = 0, status = 'agotado' WHERE id = ?").run(req.params.id);
  res.redirect('/admin/products');
});

module.exports = router;
