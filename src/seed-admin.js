// Uso: node src/seed-admin.js "Nombre" correo@ejemplo.com contraseña123
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const [name, email, password] = process.argv.slice(2);

async function main() {
  if (!name || !email || !password) {
    console.log('Uso: node src/seed-admin.js "Nombre" correo@ejemplo.com contraseña123');
    process.exit(1);
  }

  await db.initSchema();

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    await db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
    console.log(`Usuario existente "${email}" ahora es administrador.`);
  } else {
    const hash = bcrypt.hashSync(password, 10);
    await db
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(name, email.toLowerCase(), hash, 'admin');
    console.log(`Administrador creado: ${email}`);
  }

  await db.pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
