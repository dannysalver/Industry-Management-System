import { Router } from 'express';
import pool from '../db.js';
import { withTx } from '../lib/txn.js';
import { requireVersion, updateVersioned, sendConflict } from '../lib/optimistic.js';
import { broadcast } from '../lib/events.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('GET /clients error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, contact, email, address } = req.body;
    const result = await pool.query(
      'INSERT INTO clients (name, type, contact, email, address) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, type || 'Walk-in Customer', contact, email, address]
    );
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'Created client', 'client', $3, $4)`,
      [req.user.id, req.user.name, result.rows[0].id, name]
    );
    broadcast('data', { entity: 'clients', op: 'created', id: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /clients error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, contact, email, address } = req.body;
    const expectedVersion = requireVersion(req.body);

    const updated = await withTx(async (client) => {
      const row = await updateVersioned(
        client,
        'clients',
        id,
        'name=$1, type=$2, contact=$3, email=$4, address=$5, updated_at=NOW()',
        [name, type, contact, email, address],
        expectedVersion
      );
      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
         VALUES ($1, $2, 'Updated client', 'client', $3, $4)`,
        [req.user.id, req.user.name, id, name]
      );
      return row;
    });

    broadcast('data', { entity: 'clients', op: 'updated', id: updated.id });
    res.json(updated);
  } catch (err) {
    if (sendConflict(res, err)) return;
    console.error('PUT /clients/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const del = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING id, name', [id]);
    if (del.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'Deleted client', 'client', $3, $4)`,
      [req.user.id, req.user.name, id, del.rows[0].name]
    );
    broadcast('data', { entity: 'clients', op: 'deleted', id: Number(id) });
    res.status(204).send();
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ message: 'Cannot delete client: they have existing sales. Remove or reassign those sales first.' });
    }
    console.error('DELETE /clients error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
