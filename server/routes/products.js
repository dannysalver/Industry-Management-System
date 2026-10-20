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

function deleteImageFile(imageUrl) {
  if (!imageUrl) return;
  const filePath = path.join(__dirname, '..', '..', imageUrl.replace(/^\//, ''));
  fs.unlink(filePath, (err) => { if (err && err.code !== 'ENOENT') console.warn('Failed to delete image:', err.message); });
}

const router = Router();

router.get('/types', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM product_type ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('GET /product-types error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, pt.name AS type_name
       FROM products p
       LEFT JOIN product_type pt ON p.type = pt.id
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /products error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (product.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    const materials = await pool.query(
      `SELECT pm.*, m.name AS material_name, m.unit
       FROM product_materials pm
       JOIN materials m ON pm.material_id = m.id
       WHERE pm.product_id = $1`,
      [id]
    );
    res.json({ ...product.rows[0], materials: materials.rows });
  } catch (err) {
    console.error('GET /products/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

async function upsertProductMaterials(productId, materials, client) {
  if (!materials || materials.length === 0) return;
  await client.query('DELETE FROM product_materials WHERE product_id = $1', [productId]);
  for (const mat of materials) {
    const typeResult = await client.query(
      'SELECT m.name, m.unit FROM materials m WHERE m.id = $1', [mat.material_id]
    );
    const unit = typeResult.rows[0]?.unit || '';
    await client.query(
      `INSERT INTO product_materials (product_id, material_id, quantity, unit)
       VALUES ($1, $2, $3, $4)`,
      [productId, mat.material_id, mat.quantity, unit]
    );
  }
}

router.post('/', async (req, res) => {
  try {
    const { name, type, price, production_time, expiry_days, image_url, materials } = req.body;
    const created = await withTx(async (client) => {
      const result = await client.query(
        `INSERT INTO products (name, type, price, production_time, expiry_days, image_url)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [name, type, price, production_time, expiry_days, image_url]
      );
      await upsertProductMaterials(result.rows[0].id, materials, client);
      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
         VALUES ($1, $2, 'Created product', 'product', $3, $4)`,
        [req.user.id, req.user.name, result.rows[0].id, name]
      );
      return result.rows[0];
    });
    broadcast('data', { entity: 'products', op: 'created', id: created.id });
    res.status(201).json(created);
  } catch (err) {
    if (sendConflict(res, err)) return;
    console.error('POST /products error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, price, production_time, expiry_days, image_url, materials } = req.body;
    const expectedVersion = requireVersion(req.body);

    const old = await pool.query('SELECT image_url FROM products WHERE id = $1', [id]);
    if (old.rows.length === 0) return res.status(404).json({ message: 'Product not found' });

    const updated = await withTx(async (client) => {
      const row = await updateVersioned(
        client,
        'products',
        id,
        'name=$1, type=$2, price=$3, production_time=$4, expiry_days=$5, image_url=$6, updated_at=NOW()',
        [name, type, price, production_time, expiry_days, image_url],
        expectedVersion
      );
      await upsertProductMaterials(id, materials, client);
      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
         VALUES ($1, $2, 'Updated product', 'product', $3, $4)`,
        [req.user.id, req.user.name, id, name]
      );
      return row;
    });

    if (old.rows[0].image_url && old.rows[0].image_url !== image_url) {
      deleteImageFile(old.rows[0].image_url);
    }

    broadcast('data', { entity: 'products', op: 'updated', id: updated.id });
    res.json(updated);
  } catch (err) {
    if (sendConflict(res, err)) return;
    console.error('PUT /products/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await pool.query('SELECT image_url FROM products WHERE id = $1', [id]);
    if (product.rows.length === 0) return res.status(404).json({ message: 'Product not found' });

    deleteImageFile(product.rows[0].image_url);

    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id)
       VALUES ($1, $2, 'Deleted product', 'product', $3)`,
      [req.user.id, req.user.name, id]
    );
    broadcast('data', { entity: 'products', op: 'deleted', id: Number(id) });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /products/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
