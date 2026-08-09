require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const { loadUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const checkoutRoutes = require('./routes/checkout');
const adminRoutes = require('./routes/admin');
const profileRoutes = require('./routes/profile');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use(loadUser);

app.use('/', productRoutes);
app.use('/', authRoutes);
app.use('/', checkoutRoutes);
app.use('/', profileRoutes);
app.use('/', adminRoutes);

app.use((req, res) => {
  res.status(404).render('error', { message: 'Página no encontrada.' });
});

// Manejador de errores (ej. archivos demasiado grandes en multer)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: err.message || 'Algo salió mal.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Eli Store corriendo en http://localhost:${PORT}`);
});
