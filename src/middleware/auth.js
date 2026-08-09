const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambia-esto-en-produccion';

// Lee el token de la cookie (si existe) y adjunta req.user
function loadUser(req, res, next) {
  const token = req.cookies && req.cookies.token;
  req.user = null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.id);
      if (user) req.user = user;
    } catch (e) {
      // token inválido o expirado: se ignora, req.user queda null
    }
  }
  res.locals.user = req.user; // disponible en todas las vistas EJS
  res.locals.currentPath = req.path;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).render('error', { message: 'No tienes permiso para ver esta página.' });
    }
    next();
  };
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

module.exports = { loadUser, requireAuth, requireRole, signToken, JWT_SECRET };
