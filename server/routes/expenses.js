import { Router } from 'express';
import pool from '../db.js';
import { withTx } from '../lib/txn.js';
import { requireVersion, updateVersioned, sendConflict } from '../lib/optimistic.js';
import { broadcast } from '../lib/events.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, u.name as created_by_name
       FROM expenses e
       LEFT JOIN users u ON e.created_by = u.id
       ORDER BY e.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /expenses error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { type, amount, date } = req.body;
    const result = await pool.query(
      `INSERT INTO expenses (type, amount, date, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [type, amount, date || new Date().toISOString().slice(0, 10), req.user.id]
    );
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'Created expense', 'expense', $3, $4)`,
      [req.user.id, req.user.name, result.rows[0].id, `${type}: ${amount}`]
    );
    broadcast('data', { entity: 'expenses', op: 'created', id: result.rows[0].id });
    broadcast('data', { entity: 'records', op: 'changed' });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /expenses error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, date } = req.body;
    const expectedVersion = requireVersion(req.body);

    const updated = await withTx(async (client) => {
      const row = await updateVersioned(client, 'expenses', id, 'type=$1, amount=$2, date=$3', [type, amount, date], expectedVersion);
      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
         VALUES ($1, $2, 'Updated expense', 'expense', $3, $4)`,
        [req.user.id, req.user.name, id, `${type}: ${amount}`]
      );
      return row;
    });

    broadcast('data', { entity: 'expenses', op: 'updated', id: updated.id });
    broadcast('data', { entity: 'records', op: 'changed' });
    res.json(updated);
  } catch (err) {
    if (sendConflict(res, err)) return;
    console.error('PUT /expenses/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const del = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING id, type, amount', [id]);
    if (del.rows.length === 0) return res.status(404).json({ message: 'Expense not found' });
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'Deleted expense', 'expense', $3, $4)`,
      [req.user.id, req.user.name, id, `${del.rows[0].type}: ${del.rows[0].amount}`]
    );
    broadcast('data', { entity: 'expenses', op: 'deleted', id: Number(id) });
    broadcast('data', { entity: 'records', op: 'changed' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /expenses error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
