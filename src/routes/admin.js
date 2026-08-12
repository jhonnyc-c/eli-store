const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/admin', async (req, res, next) => {
  try {
    const totals = await db
      .prepare(
        `SELECT
           COUNT(*) AS total_orders,
           COALESCE(SUM(total_price), 0) AS total_gmv,
           COALESCE(SUM(commission_amount), 0) AS total_commission
         FROM orders WHERE status = 'pagado'`
      )
      .get();
    const usersCountRow = await db.prepare('SELECT COUNT(*) AS c FROM users').get();
    const listingsCountRow = await db.prepare('SELECT COUNT(*) AS c FROM listings').get();
    const recentOrders = await db
      .prepare(
        `SELECT orders.*, l.name AS listing_name, s.name AS seller_name
         FROM orders
         JOIN listings l ON l.id = orders.listing_id
         JOIN users s ON s.id = orders.seller_id
         ORDER BY orders.created_at DESC LIMIT 20`
      )
      .all();

    res.render('admin/dashboard', {
      totals: {
        total_orders: Number(totals.total_orders),
        total_gmv: Number(totals.total_gmv),
        total_commission: Number(totals.total_commission),
      },
      usersCount: Number(usersCountRow.c),
      listingsCount: Number(listingsCountRow.c),
      recentOrders,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/admin/users', async (req, res, next) => {
  try {
    const users = await db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC').all();
    res.render('admin/users', { users });
  } catch (e) {
    next(e);
  }
});

router.post('/admin/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['comprador', 'vendedor', 'admin'].includes(role)) return res.redirect('/admin/users');
    await db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    res.redirect('/admin/users');
  } catch (e) {
    next(e);
  }
});

router.get('/admin/products', async (req, res, next) => {
  try {
    const listings = await db
      .prepare(
        `SELECT listings.*, users.name AS seller_name
         FROM listings JOIN users ON users.id = listings.seller_id
         ORDER BY listings.created_at DESC`
      )
      .all();
    res.render('admin/products', { listings });
  } catch (e) {
    next(e);
  }
});

router.post('/admin/listings/:id/delete', async (req, res, next) => {
  try {
    await db.prepare('DELETE FROM listings WHERE id = ?').run(req.params.id);
    res.redirect('/admin/products');
  } catch (e) {
    res.status(400).render('error', {
      message:
        'No se puede eliminar esta prenda porque ya tiene compras registradas (se perderían los comprobantes). Puedes marcarla como agotada en su lugar.',
    });
  }
});

router.post('/admin/listings/:id/mark-out-of-stock', async (req, res, next) => {
  try {
    await db.prepare("UPDATE listings SET stock = 0, status = 'agotado' WHERE id = ?").run(req.params.id);
    res.redirect('/admin/products');
  } catch (e) {
    next(e);
  }
});

module.exports = router;
