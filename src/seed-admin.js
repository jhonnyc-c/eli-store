// Uso: node src/seed-admin.js "Nombre" correo@ejemplo.com contraseña123
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const [name, email, password] = process.argv.slice(2);

if (!name || !email || !password) {
  console.log('Uso: node src/seed-admin.js "Nombre" correo@ejemplo.com contraseña123');
  process.exit(1);
}

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
if (existing) {
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
  console.log(`Usuario existente "${email}" ahora es administrador.`);
} else {
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
    name,
    email.toLowerCase(),
    hash,
    'admin'
  );
  console.log(`Administrador creado: ${email}`);
}
