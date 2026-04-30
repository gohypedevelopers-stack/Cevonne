require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('node:path');

const { env } = require('./src/config');
const { errorHandler } = require('./src/middleware/error');
const userRoutes = require('./src/routes/user.routes');
const productRoutes = require('./src/routes/product.routes');
const shadeRoutes = require('./src/routes/shade.routes');
const collectionRoutes = require('./src/routes/collection.routes');
const inventoryRoutes = require('./src/routes/inventory.routes');
const uploadRoutes = require('./src/routes/upload.routes');
const reviewRoutes = require('./src/routes/review.routes');
const orderRoutes = require('./src/routes/order.routes');

const app = express();

const allowedOrigins = [
  env.frontendUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

const isLocalDevOrigin = (origin = '') => {
  if (typeof origin !== 'string') return false;
  return origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: Origin not allowed: ${origin}`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (_req, res) => {
  res.status(200).json({ message: 'Marvelle API is running successfully.' });
});

app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/shades', shadeRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/orders', orderRoutes);

app.use((err, req, res, next) => {
  if (err && String(err.message || '').startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }
  return errorHandler(err, req, res, next);
});

app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));

if (env.nodeEnv !== 'production') {
  app.listen(env.port, () => {
    console.log(`Marvelle API ready on http://localhost:${env.port}`);
  });
}

module.exports = app;
