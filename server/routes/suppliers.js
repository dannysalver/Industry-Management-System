import { Router } from 'express';
import pool from '../db.js';
import { withTx } from '../lib/txn.js';
import { requireVersion, updateVersioned, sendConflict } from '../lib/optimistic.js';
import { broadcast } from '../lib/events.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, COALESCE(json_agg(json_build_object('material_id', sm.material_id, 'material_name', m.name, 'unit', sm.unit, 'price_per_unit', sm.price_per_unit)) FILTER (WHERE sm.material_id IS NOT NULL), '[]') as materials_supplied FROM suppliers s LEFT JOIN supplier_materials sm ON s.id = sm.supplier_id LEFT JOIN materials m ON sm.material_id = m.id GROUP BY s.id ORDER BY s.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /suppliers error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, contact, email, address, materials } = req.body;
    const supplier = await withTx(async (client) => {
      const result = await client.query(
        'INSERT INTO suppliers (name, contact, email, address) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, contact, email, address]
      );
      const row = result.rows[0];
      if (materials && materials.length > 0) {
        for (const m of materials) {
          await client.query(
            'INSERT INTO supplier_materials (supplier_id, material_id, unit, price_per_unit) VALUES ($1, $2, $3, $4) ON CONFLICT (supplier_id, material_id) DO UPDATE SET unit=$3, price_per_unit=$4',
            [row.id, m.material_id, m.unit, m.price_per_unit]
          );
        }
      }
      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
         VALUES ($1, $2, 'Created supplier', 'supplier', $3, $4)`,
        [req.user.id, req.user.name, row.id, name]
      );
      return row;
    });
    broadcast('data', { entity: 'suppliers', op: 'created', id: supplier.id });
    res.status(201).json(supplier);
  } catch (err) {
    console.error('POST /suppliers error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact, email, address, materials } = req.body;
    const expectedVersion = requireVersion(req.body);

    const updated = await withTx(async (client) => {
      const row = await updateVersioned(
        client,
        'suppliers',
        id,
        'name=$1, contact=$2, email=$3, address=$4, updated_at=NOW()',
        [name, contact, email, address],
        expectedVersion
      );
      await client.query('DELETE FROM supplier_materials WHERE supplier_id = $1', [id]);
      if (materials && materials.length > 0) {
        for (const m of materials) {
          await client.query(
            'INSERT INTO supplier_materials (supplier_id, material_id, unit, price_per_unit) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
            [id, m.material_id, m.unit, m.price_per_unit]
          );
        }
      }
      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
         VALUES ($1, $2, 'Updated supplier', 'supplier', $3, $4)`,
        [req.user.id, req.user.name, id, name]
      );
      return row;
    });

    broadcast('data', { entity: 'suppliers', op: 'updated', id: updated.id });
    res.json(updated);
  } catch (err) {
    if (sendConflict(res, err)) return;
    console.error('PUT /suppliers/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const del = await pool.query('DELETE FROM suppliers WHERE id = $1 RETURNING id, name', [id]);
    if (del.rows.length === 0) return res.status(404).json({ message: 'Supplier not found' });
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'Deleted supplier', 'supplier', $3, $4)`,
      [req.user.id, req.user.name, id, del.rows[0].name]
    );
    broadcast('data', { entity: 'suppliers', op: 'deleted', id: Number(id) });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /suppliers error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
