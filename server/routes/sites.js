import { Router } from 'express';
import pool from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sites ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('GET /sites error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, location, contact } = req.body;
    const result = await pool.query(
      'INSERT INTO sites (name, location, contact) VALUES ($1, $2, $3) RETURNING *',
      [name, location, contact]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /sites error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, contact } = req.body;
    const result = await pool.query(
      'UPDATE sites SET name=$1, location=$2, contact=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [name, location, contact, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Site not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /sites/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM sites WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Site not found' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /sites/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
