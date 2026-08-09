const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const COMMISSION_RATE = 0.10;

// --- Configuracion de subida de imagenes a disco ---
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 6 }, // 5MB por foto, max 6 fotos
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo se permiten imagenes'));
    cb(null, true);
  },
});

function withImages(listing) {
  const images = db
    .prepare('SELECT filename FROM listing_images WHERE listing_id = ? ORDER BY position ASC')
    .all(listing.id)
    .map((r) => '/uploads/' + r.filename);
  const net = +(listing.price * (1 - COMMISSION_RATE)).toFixed(2);
  const commission = +(listing.price * COMMISSION_RATE).toFixed(2);
  return { ...listing, images, net, commission };
}

// Catalogo
router.get('/', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  let rows = db
    .prepare(
      `SELECT listings.*, users.name AS seller_name
       FROM listings JOIN users ON users.id = listings.seller_id
       ORDER BY listings.created_at DESC`
    )
    .all();
  if (q) {
    rows = rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
    );
  }
  res.render('home', { listings: rows.map(withImages), q: req.query.q || '' });
});

// Formulario de publicar (requiere sesion y rol vendedor o admin)
router.get('/sell', requireAuth, requireRole('vendedor', 'admin'), (req, res) => {
  res.render('sell', { error: null });
});

router.post(
  '/sell',
  requireAuth,
  requireRole('vendedor', 'admin'),
  upload.array('images', 6),
  (req, res) => {
    const { name, price, category, description, stock } = req.body;
    const priceNum = parseFloat(price);
    const stockNum = Math.max(1, parseInt(stock, 10) || 1);

    if (!name || !priceNum || priceNum <= 0 || !category) {
      return res.status(400).render('sell', { error: 'Completa el nombre, precio y categoría.' });
    }

    const info = db
      .prepare(
        'INSERT INTO listings (seller_id, name, description, price, category, stock) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(req.user.id, name.trim(), (description || '').trim(), priceNum, category, stockNum);

    const listingId = info.lastInsertRowid;
    const files = req.files || [];
    const insertImg = db.prepare(
      'INSERT INTO listing_images (listing_id, filename, position) VALUES (?, ?, ?)'
    );
    files.forEach((f, i) => insertImg.run(listingId, f.filename, i));

    res.redirect('/product/' + listingId);
  }
);

// Detalle de producto
router.get('/product/:id', (req, res) => {
  const listing = db
    .prepare(
      `SELECT listings.*, users.name AS seller_name
       FROM listings JOIN users ON users.id = listings.seller_id
       WHERE listings.id = ?`
    )
    .get(req.params.id);
  if (!listing) return res.status(404).render('error', { message: 'Prenda no encontrada.' });
  res.render('product', { listing: withImages(listing) });
});

module.exports = router;
module.exports.withImages = withImages;
module.exports.COMMISSION_RATE = COMMISSION_RATE;
