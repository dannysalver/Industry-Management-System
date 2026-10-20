import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';
import auth from './middleware/auth.js';
import authorize from './middleware/authorize.js';
import authRoutes from './routes/auth.js';
import materialsRoutes from './routes/materials.js';
import productsRoutes from './routes/products.js';
import productionsRoutes from './routes/productions.js';
import stockRoutes from './routes/stock.js';
import salesRoutes from './routes/sales.js';
import expensesRoutes from './routes/expenses.js';
import sitesRoutes from './routes/sites.js';
import clientsRoutes from './routes/clients.js';
import suppliersRoutes from './routes/suppliers.js';
import recordsRoutes from './routes/records.js';
import uploadRoutes from './routes/upload.js';
import rolesRoutes from './routes/roles.js';
import eventsRoutes from './routes/events.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/storage', express.static(path.join(__dirname, '..', 'storage')));

app.use('/api/auth', authRoutes);
app.use('/api/roles', auth, rolesRoutes);
app.use('/api/materials', auth, authorize('Store Keeper', 'Production Manager'), materialsRoutes);
app.use('/api/products', auth, authorize('Store Keeper', 'Production Manager'), productsRoutes);
app.use('/api/productions', auth, authorize('Production Manager'), productionsRoutes);
app.use('/api/stock', auth, authorize('Store Keeper', 'Production Manager'), stockRoutes);
app.use('/api/sales', auth, authorize('Sales Officer', 'Accountant'), salesRoutes);
app.use('/api/expenses', auth, authorize('Sales Officer', 'Accountant'), expensesRoutes);
app.use('/api/sites', auth, sitesRoutes);
app.use('/api/clients', auth, authorize('Sales Officer', 'Accountant'), clientsRoutes);
app.use('/api/suppliers', auth, authorize('Sales Officer', 'Accountant'), suppliersRoutes);
app.use('/api/records', auth, recordsRoutes);
app.use('/api/upload', auth, uploadRoutes);
app.use('/api/events', eventsRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(500)`)
  .then(() => console.log('Migration: added avatar column to users'))
  .catch((err) => console.error('Migration error:', err.message));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
