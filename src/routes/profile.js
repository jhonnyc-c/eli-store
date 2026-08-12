const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const myListings = await db
      .prepare('SELECT * FROM listings WHERE seller_id = ? ORDER BY created_at DESC')
      .all(req.user.id);

    const mySales = await db
      .prepare(
        `SELECT orders.*, l.name AS listing_name
         FROM orders JOIN listings l ON l.id = orders.listing_id
         WHERE orders.seller_id = ? AND orders.status = 'pagado'
         ORDER BY orders.created_at DESC`
      )
      .all(req.user.id);

    const myPurchases = await db
      .prepare(
        `SELECT orders.*, l.name AS listing_name
         FROM orders JOIN listings l ON l.id = orders.listing_id
         WHERE orders.buyer_id = ? ORDER BY orders.created_at DESC`
      )
      .all(req.user.id);

    const totalEarnings = mySales.reduce((sum, o) => sum + Number(o.seller_net), 0);

    res.render('profile', { myListings, mySales, myPurchases, totalEarnings: totalEarnings.toFixed(2) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
