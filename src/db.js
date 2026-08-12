require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error(
    'Falta la variable de entorno DATABASE_URL. Consulta el README para crear una base de datos gratis en Neon y configurarla.'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
});

// Convierte los "?" (estilo SQLite) a "$1, $2, ..." (estilo Postgres) automáticamente,
// para que el resto del código no tenga que cambiar cómo escribe sus consultas.
function toPgQuery(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Capa de compatibilidad: imita la forma de escribir consultas que ya usábamos
// (db.prepare(sql).get(...) / .all(...) / .run(...)), pero por dentro habla con Postgres.
// La diferencia principal es que ahora son funciones asíncronas (hay que usar "await").
function prepare(sql) {
  const pgSql = toPgQuery(sql);
  return {
    async get(...params) {
      const res = await pool.query(pgSql, params);
      return res.rows[0] || null;
    },
    async all(...params) {
      const res = await pool.query(pgSql, params);
      return res.rows;
    },
    async run(...params) {
      const res = await pool.query(pgSql, params);
      return {
        changes: res.rowCount,
        lastInsertRowid: res.rows[0] ? res.rows[0].id : undefined,
      };
    },
  };
}

async function exec(sql) {
  return pool.query(sql);
}

// ---------- ESQUEMA ----------
async function initSchema() {
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'comprador',
      created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
    );

    CREATE TABLE IF NOT EXISTS listings (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL,
      category TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'en_venta',
      created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint
    );

    CREATE TABLE IF NOT EXISTS listing_images (
      id SERIAL PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
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
      status TEXT NOT NULL DEFAULT 'pendiente_pago',
      created_at BIGINT NOT NULL DEFAULT extract(epoch from now())::bigint,
      paid_at BIGINT
    );
  `);
}

module.exports = { prepare, exec, pool, initSchema };
