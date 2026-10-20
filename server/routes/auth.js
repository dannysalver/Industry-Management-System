import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import auth from '../middleware/auth.js';
import authorize from '../middleware/authorize.js';
import { withTx } from '../lib/txn.js';
import { requireVersion, updateVersioned, sendConflict } from '../lib/optimistic.js';
import { notifyUser } from '../lib/events.js';
import { JWT_SECRET } from '../config.js';

async function checkLowStockNotifications(user) {
  const mats = await pool.query(
    `SELECT m.id, m.name, m.stock_threshold,
            COALESCE((SELECT SUM(quantity) FROM stock_transactions WHERE item_type='material' AND item_id=m.id), 0) AS stock_qty
     FROM materials m WHERE m.stock_threshold > 0`
  );
  for (const mat of mats.rows) {
    const stockQty = Number(mat.stock_qty);
    if (stockQty < mat.stock_threshold) {
      const notif = await pool.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4) RETURNING *`,
        [user.id, `Low Stock: ${mat.name}`, `Current stock (${stockQty}) is below threshold (${mat.stock_threshold})`, 'warning']
      );
      notifyUser(user.id, notif.rows[0]);
    }
  }
}

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await pool.query(
      'SELECT u.*, r.role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role_id: user.role_id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });

    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type) VALUES ($1, $2, 'Logged in', 'auth')`,
      [user.id, user.name]
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role_id: user.role_id, role: user.role, avatar: user.avatar }
    });

    checkLowStockNotifications(user).catch((err) => console.error('Low stock check on login error:', err));
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/me', auth, async (req, res) => {
  try {
    const { name, currentPassword, newPassword, avatar } = req.body;

    if (!name) return res.status(400).json({ message: 'Name is required' });

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: 'Current password is required to set a new password' });
      const pwResult = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
      const valid = await bcrypt.compare(currentPassword, pwResult.rows[0].password);
      if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });
    }

    let sql = 'UPDATE users SET name=$1, avatar=$2, updated_at=NOW()';
    const params = [name, avatar || null];

    if (newPassword) {
      const hashed = await bcrypt.hash(newPassword, 10);
      sql += ', password=$3';
      params.push(hashed);
    }

    sql += ' WHERE id=$' + (params.length + 1) + ' RETURNING id, name, email, avatar, role_id';
    params.push(req.user.id);

    const result = await pool.query(sql, params);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    const user = result.rows[0];
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type) VALUES ($1, $2, 'Updated profile', 'auth')`,
      [user.id, user.name]
    );

    res.json({ user });
  } catch (err) {
    console.error('PUT /auth/me error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT u.id, u.name, u.email, u.role_id, u.avatar, r.role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/users', auth, authorize('Admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT u.id, u.name, u.email, u.role_id, r.role FROM users u LEFT JOIN roles r ON u.role_id = r.id ORDER BY u.name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /auth/users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/users', auth, authorize('Admin'), async (req, res) => {
  try {
    const { name, email, password, role_id } = req.body;
    if (!name || !email || !password || !role_id) {
      return res.status(400).json({ message: 'Name, email, password, and role are required' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role_id) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role_id',
      [name, email, hashed, role_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Email already exists' });
    console.error('POST /auth/users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/users/:id', auth, authorize('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role_id } = req.body;
    if (!name || !email || !role_id) {
      return res.status(400).json({ message: 'Name, email, and role are required' });
    }
    const expectedVersion = requireVersion(req.body);

    let setClause = 'name=$1, email=$2, role_id=$3';
    const params = [name, email, role_id];
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      setClause += ', password=$4';
      params.push(hashed);
    }

    const updated = await withTx(async (client) => {
      const row = await updateVersioned(client, 'users', id, `${setClause}, updated_at=NOW()`, params, expectedVersion);
      delete row.password;
      return row;
    });

    res.json(updated);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Email already exists' });
    if (sendConflict(res, err)) return;
    console.error('PUT /auth/users/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/users/:id', auth, authorize('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /auth/users/:id error:', err);
    if (err.code === '23503') {
      return res.status(400).json({ message: 'Cannot delete user: they have existing records. Remove or reassign their records first.' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
