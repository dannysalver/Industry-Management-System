import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import { withTx } from '../lib/txn.js';
import { requireVersion, updateVersioned, sendConflict } from '../lib/optimistic.js';
import { broadcast } from '../lib/events.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

router.get('/types', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM material_type ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('GET /material-types error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, mt.name AS type_name, mt.category
       FROM materials m
       LEFT JOIN material_type mt ON m.type = mt.id
       ORDER BY m.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /materials error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM materials WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Material not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /materials/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, price_per_unit, stock_threshold, image_url } = req.body;
    const typeResult = await pool.query('SELECT category FROM material_type WHERE id = $1', [type]);
    const category = typeResult.rows[0]?.category || 'liquid';
    const unit = category === 'solid' ? 'kg' : 'ltrs';
    const result = await pool.query(
      `INSERT INTO materials (name, type, unit, price_per_unit, stock_threshold, image_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, type, unit, price_per_unit, stock_threshold || 0, image_url]
    );
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'Created material', 'material', $3, $4)`,
      [req.user.id, req.user.name, result.rows[0].id, name]
    );
    broadcast('data', { entity: 'materials', op: 'created', id: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /materials error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

function deleteImageFile(imageUrl) {
  if (!imageUrl) return;
  const filePath = path.join(__dirname, '..', '..', imageUrl.replace(/^\//, ''));
  fs.unlink(filePath, (err) => { if (err && err.code !== 'ENOENT') console.warn('Failed to delete image:', err.message); });
}

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, price_per_unit, stock_threshold, image_url } = req.body;
    const expectedVersion = requireVersion(req.body);

    const old = await pool.query('SELECT image_url FROM materials WHERE id = $1', [id]);
    if (old.rows.length === 0) return res.status(404).json({ message: 'Material not found' });

    const typeResult = await pool.query('SELECT category FROM material_type WHERE id = $1', [type]);
    const category = typeResult.rows[0]?.category || 'liquid';
    const unit = category === 'solid' ? 'kg' : 'ltrs';

    const updated = await withTx(async (client) => {
      const row = await updateVersioned(
        client,
        'materials',
        id,
        'name=$1, type=$2, unit=$3, price_per_unit=$4, stock_threshold=$5, image_url=$6, updated_at=NOW()',
        [name, type, unit, price_per_unit, stock_threshold || 0, image_url],
        expectedVersion
      );
      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
         VALUES ($1, $2, 'Updated material', 'material', $3, $4)`,
        [req.user.id, req.user.name, id, name]
      );
      return row;
    });

    if (old.rows[0].image_url && old.rows[0].image_url !== image_url) {
      deleteImageFile(old.rows[0].image_url);
    }

    broadcast('data', { entity: 'materials', op: 'updated', id: updated.id });
    res.json(updated);
  } catch (err) {
    if (sendConflict(res, err)) return;
    console.error('PUT /materials/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const material = await pool.query('SELECT image_url FROM materials WHERE id = $1', [id]);
    if (material.rows.length === 0) return res.status(404).json({ message: 'Material not found' });

    deleteImageFile(material.rows[0].image_url);

    await pool.query('DELETE FROM materials WHERE id = $1', [id]);
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id)
       VALUES ($1, $2, 'Deleted material', 'material', $3)`,
      [req.user.id, req.user.name, id]
    );
    broadcast('data', { entity: 'materials', op: 'deleted', id: Number(id) });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /materials/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
