import { Router } from 'express';
import pool from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM roles ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('GET /roles error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
