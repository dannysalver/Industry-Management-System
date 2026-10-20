import { Router } from 'express';
import pool from '../db.js';
import { withTx } from '../lib/txn.js';
import { lockItem, getStockBalance } from '../lib/stock.js';
import { broadcast, notifyUser } from '../lib/events.js';

async function checkLowStock(itemId, user) {
  try {
    const matResult = await pool.query(`SELECT name, stock_threshold FROM materials WHERE id = $1`, [itemId]);
    if (matResult.rows.length === 0) return;
    const { name, stock_threshold } = matResult.rows[0];
    const stockQty = await getStockBalance(pool, 'material', itemId);
    if (stock_threshold > 0 && stockQty < stock_threshold) {
      const notif = await pool.query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4) RETURNING *`,
        [user.id, `Low Stock: ${name}`, `Current stock (${stockQty}) is below threshold (${stock_threshold})`, 'warning']
      );
      notifyUser(user.id, notif.rows[0]);
    }
  } catch (err) {
    console.error('Low stock check error:', err);
  }
}

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { item_type } = req.query;
    let sql = `SELECT st.*, u.name as created_by_name
               FROM stock_transactions st
               LEFT JOIN users u ON st.created_by = u.id`;
    const params = [];
    if (item_type) {
      sql += ` WHERE st.item_type = $1`;
      params.push(item_type);
    }
    sql += ` ORDER BY st.created_at DESC`;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /stock error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { item_type, item_id, item_name, transaction_type, quantity, unit_price, reference_id, reference_type, notes } = req.body;
    if (!item_type || !item_id || !transaction_type || quantity === undefined) {
      return res.status(400).json({ message: 'item_type, item_id, transaction_type and quantity are required' });
    }

    const row = await withTx(async (client) => {
      const item = await lockItem(client, item_type, item_id);
      if (!item) {
        const err = new Error('Item not found');
        err.status = 404;
        throw err;
      }

      if (Number(quantity) < 0) {
        const available = await getStockBalance(client, item_type, item_id);
        if (available + Number(quantity) < 0) {
          const err = new Error(`Insufficient stock for "${item.name}" (Available: ${available}, Requested change: ${quantity})`);
          err.status = 400;
          throw err;
        }
      }

      const result = await client.query(
        `INSERT INTO stock_transactions (item_type, item_id, item_name, transaction_type, quantity, unit_price, reference_id, reference_type, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [item_type, item_id, item_name || item.name, transaction_type, quantity, unit_price, reference_id, reference_type, notes, req.user.id]
      );

      if (item_type === 'material' && transaction_type === 'in') {
        const amount = Number(quantity) * Number(item.price_per_unit);
        await client.query(
          `INSERT INTO expenses (type, amount, date, created_by) VALUES ($1, $2, CURRENT_DATE, $3)`,
          ['Raw Materials', amount, req.user.id]
        );
      }

      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
         VALUES ($1, $2, 'Stock transaction', 'stock', $3, $4)`,
        [req.user.id, req.user.name, result.rows[0].id, `${transaction_type}: ${item_name || item.name} ${quantity}`]
      );
      return result.rows[0];
    });

    broadcast('data', { entity: 'stock', op: 'changed' });
    broadcast('data', { entity: 'expenses', op: 'created' });
    broadcast('data', { entity: 'records', op: 'changed' });
    broadcast('data', { entity: 'dashboard', op: 'changed' });
    res.status(201).json(row);

    if (item_type === 'material') {
      checkLowStock(item_id, req.user).catch((err) => console.error('Threshold check error:', err));
    }
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('POST /stock error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/items/:type', async (req, res) => {
  try {
    const { type } = req.params;
    if (type === 'material') {
      const result = await pool.query(
        `SELECT m.*, mt.name AS type_name,
                COALESCE((SELECT SUM(quantity) FROM stock_transactions WHERE item_type='material' AND item_id=m.id), 0) AS stock_quantity
         FROM materials m
         LEFT JOIN material_type mt ON m.type = mt.id
         ORDER BY m.name`
      );
      return res.json(result.rows);
    }
    if (type === 'product') {
      const result = await pool.query(
        `SELECT p.*, pt.name AS type_name,
                COALESCE((SELECT SUM(quantity) FROM stock_transactions WHERE item_type='product' AND item_id=p.id), 0) AS stock_quantity
         FROM products p
         LEFT JOIN product_type pt ON p.type = pt.id
         ORDER BY p.name`
      );
      return res.json(result.rows);
    }
    res.status(400).json({ message: 'Invalid type, use "material" or "product"' });
  } catch (err) {
    console.error('GET /stock/items/:type error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const result = await pool.query(
      `UPDATE stock_transactions SET notes=$1 WHERE id=$2 RETURNING *`,
      [notes, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Stock transaction not found' });
    broadcast('data', { entity: 'stock', op: 'changed' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /stock/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM stock_transactions WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Stock transaction not found' });
    broadcast('data', { entity: 'stock', op: 'changed' });
    broadcast('data', { entity: 'dashboard', op: 'changed' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /stock/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
