const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/profile', requireAuth, (req, res) => {
  const myListings = db
    .prepare('SELECT * FROM listings WHERE seller_id = ? ORDER BY created_at DESC')
    .all(req.user.id);

  const mySales = db
    .prepare(
      `SELECT orders.*, l.name AS listing_name
       FROM orders JOIN listings l ON l.id = orders.listing_id
       WHERE orders.seller_id = ? AND orders.status = 'pagado'
       ORDER BY orders.created_at DESC`
    )
    .all(req.user.id);

  const myPurchases = db
    .prepare(
      `SELECT orders.*, l.name AS listing_name
       FROM orders JOIN listings l ON l.id = orders.listing_id
       WHERE orders.buyer_id = ? ORDER BY orders.created_at DESC`
    )
    .all(req.user.id);

  const totalEarnings = mySales.reduce((sum, o) => sum + o.seller_net, 0);

  res.render('profile', { myListings, mySales, myPurchases, totalEarnings: totalEarnings.toFixed(2) });
});

module.exports = router;
