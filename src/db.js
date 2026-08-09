const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'percha.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// ---------- ESQUEMA ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'comprador', -- comprador | vendedor | admin
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  category TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'en_venta', -- en_venta | agotado
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS listing_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  buyer_id INTEGER NOT NULL REFERENCES users(id),
  seller_id INTEGER NOT NULL REFERENCES users(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  commission_rate REAL NOT NULL DEFAULT 0.10,
  commission_amount REAL NOT NULL,
  seller_net REAL NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  buyer_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente_pago', -- pendiente_pago | pagado | cancelado
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  paid_at INTEGER
);
`);

// ---------- MIGRACIONES SUAVES ----------
// Por si alguien ya tenia una base de datos creada con el esquema anterior,
// agregamos las columnas nuevas sin borrar nada si ya existen.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = cols.some((c) => c.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('listings', 'stock', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('orders', 'order_number', 'TEXT');
ensureColumn('orders', 'quantity', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('orders', 'unit_price', 'REAL');
ensureColumn('orders', 'total_price', 'REAL');
ensureColumn('orders', 'buyer_name', 'TEXT');
ensureColumn('orders', 'buyer_phone', 'TEXT');
ensureColumn('orders', 'buyer_address', 'TEXT');
ensureColumn('orders', 'paid_at', 'INTEGER');

module.exports = db;
