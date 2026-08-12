const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken } = require('../middleware/auth');

const router = express.Router();

router.get('/register', (req, res) => {
  res.render('register', { error: null, next: req.query.next || '/' });
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, next } = req.body;
    const safeRole = role === 'vendedor' ? 'vendedor' : 'comprador';

    if (!name || !email || !password || password.length < 6) {
      return res.status(400).render('register', {
        error: 'Completa todos los campos. La contraseña debe tener al menos 6 caracteres.',
        next: next || '/',
      });
    }

    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(400).render('register', { error: 'Ya existe una cuenta con ese correo.', next: next || '/' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const info = await db
      .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id')
      .run(name.trim(), email.toLowerCase().trim(), hash, safeRole);

    const user = await db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(info.lastInsertRowid);
    const token = signToken(user);
    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 3600 * 1000, sameSite: 'lax' });
    res.redirect(next || '/');
  } catch (e) {
    console.error(e);
    res.status(500).render('error', { message: 'No se pudo crear la cuenta. Intenta de nuevo.' });
  }
});

router.get('/login', (req, res) => {
  res.render('login', { error: null, next: req.query.next || '/' });
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, next } = req.body;
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase().trim());

    if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
      return res.status(400).render('login', { error: 'Correo o contraseña incorrectos.', next: next || '/' });
    }

    const token = signToken(user);
    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 3600 * 1000, sameSite: 'lax' });
    res.redirect(next || '/');
  } catch (e) {
    console.error(e);
    res.status(500).render('error', { message: 'No se pudo iniciar sesión. Intenta de nuevo.' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

module.exports = router;
