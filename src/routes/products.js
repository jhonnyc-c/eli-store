const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const COMMISSION_RATE = 0.10;

// --- Subida de imagenes ---
// Si hay CLOUDINARY_URL configurada, las fotos se guardan ahi (permanente).
// Si no, se guardan en el disco local del servidor (solo para pruebas: en Render
// gratis se borran cuando el servicio se reinicia).
let cloudinary = null;
if (process.env.CLOUDINARY_URL) {
  cloudinary = require('cloudinary').v2;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo se permiten imagenes'));
    cb(null, true);
  },
});

function uploadToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'eli-store' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(file.buffer);
  });
}

function saveLocally(file) {
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = crypto.randomBytes(16).toString('hex') + ext;
  const dest = path.join(__dirname, '..', '..', 'uploads', filename);
  fs.writeFileSync(dest, file.buffer);
  return filename; // se guarda solo el nombre; se le agrega "/uploads/" al mostrarlo
}

async function saveImage(file) {
  if (cloudinary) return uploadToCloudinary(file);
  return saveLocally(file);
}

function withImages(listing) {
  return db
    .prepare('SELECT filename FROM listing_images WHERE listing_id = ? ORDER BY position ASC')
    .all(listing.id)
    .then((rows) => {
      const images = rows.map((r) => (r.filename.startsWith('http') ? r.filename : '/uploads/' + r.filename));
      const net = +(listing.price * (1 - COMMISSION_RATE)).toFixed(2);
      const commission = +(listing.price * COMMISSION_RATE).toFixed(2);
      return { ...listing, images, net, commission };
    });
}

// Catalogo
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    let rows = await db
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
    const listings = await Promise.all(rows.map(withImages));
    res.render('home', { listings, q: req.query.q || '' });
  } catch (e) {
    next(e);
  }
});

// Formulario de publicar
router.get('/sell', requireAuth, requireRole('vendedor', 'admin'), (req, res) => {
  res.render('sell', { error: null });
});

router.post(
  '/sell',
  requireAuth,
  requireRole('vendedor', 'admin'),
  upload.array('images', 6),
  async (req, res, next) => {
    try {
      const { name, price, category, description, stock } = req.body;
      const priceNum = parseFloat(price);
      const stockNum = Math.max(1, parseInt(stock, 10) || 1);

      if (!name || !priceNum || priceNum <= 0 || !category) {
        return res.status(400).render('sell', { error: 'Completa el nombre, precio y categoría.' });
      }

      const info = await db
        .prepare(
          'INSERT INTO listings (seller_id, name, description, price, category, stock) VALUES (?, ?, ?, ?, ?, ?) RETURNING id'
        )
        .run(req.user.id, name.trim(), (description || '').trim(), priceNum, category, stockNum);

      const listingId = info.lastInsertRowid;
      const files = req.files || [];

      let position = 0;
      for (const file of files) {
        const savedRef = await saveImage(file);
        await db
          .prepare('INSERT INTO listing_images (listing_id, filename, position) VALUES (?, ?, ?)')
          .run(listingId, savedRef, position++);
      }

      res.redirect('/product/' + listingId);
    } catch (e) {
      next(e);
    }
  }
);

// Detalle de producto
router.get('/product/:id', async (req, res, next) => {
  try {
    const listing = await db
      .prepare(
        `SELECT listings.*, users.name AS seller_name
         FROM listings JOIN users ON users.id = listings.seller_id
         WHERE listings.id = ?`
      )
      .get(req.params.id);
    if (!listing) return res.status(404).render('error', { message: 'Prenda no encontrada.' });
    res.render('product', { listing: await withImages(listing) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
module.exports.withImages = withImages;
module.exports.COMMISSION_RATE = COMMISSION_RATE;
