import { Router } from 'express';
import pool from '../db.js';
import { withTx } from '../lib/txn.js';
import { lockItem, getStockBalance } from '../lib/stock.js';
import { broadcast, notifyUser } from '../lib/events.js';

const router = Router();

async function checkOverdueProductions() {
  try {
    const overdue = await pool.query(
      `UPDATE productions p
       SET status = 'Pending Completion', updated_at = NOW()
       FROM products pr
       WHERE p.product_id = pr.id
         AND p.status = 'In Progress'
         AND p.start_time IS NOT NULL
         AND pr.production_time > 0
         AND p.start_time + (pr.production_time * INTERVAL '1 hour') < NOW()
         AND p.created_at < NOW() - INTERVAL '5 minutes'
       RETURNING p.id, p.product_id`
    );
    for (const prod of overdue.rows) {
      const product = await pool.query('SELECT name FROM products WHERE id = $1', [prod.product_id]);
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        [1, 'Production Ready for Completion', `Production #${prod.id} for "${product.rows[0]?.name}" is ready to be marked as completed.`, 'production']
      );
    }
    if (overdue.rows.length > 0) {
      console.log(`Auto-advanced ${overdue.rows.length} production(s) to Pending Completion`);
      broadcast('data', { entity: 'production', op: 'updated' });
      broadcast('data', { entity: 'dashboard', op: 'changed' });
    }
  } catch (err) {
    console.error('checkOverdueProductions error:', err);
  }
}

router.get('/', async (req, res) => {
  try {
    await checkOverdueProductions();
    const result = await pool.query(
      `SELECT p.*, pr.name AS product_name, u.name AS started_by_name
       FROM productions p
       LEFT JOIN products pr ON p.product_id = pr.id
       LEFT JOIN users u ON p.started_by = u.id
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /productions error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT p.*, pr.name AS product_name
       FROM productions p
       LEFT JOIN products pr ON p.product_id = pr.id
       WHERE p.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Production not found' });

    const materials = await pool.query(
      `SELECT pmu.*, m.name AS material_name, m.unit
       FROM production_materials_used pmu
       JOIN materials m ON pmu.material_id = m.id
       WHERE pmu.production_id = $1`,
      [id]
    );
    res.json({ ...result.rows[0], materials_used: materials.rows });
  } catch (err) {
    console.error('GET /productions/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { product_id, materials, start_time, notes, started_by } = req.body;
    if (!product_id || !materials || materials.length === 0) {
      return res.status(400).json({ message: 'Product and at least one material are required' });
    }

    const production = await withTx(async (client) => {
      const productInfo = await client.query('SELECT production_time FROM products WHERE id = $1 FOR UPDATE', [product_id]);
      if (productInfo.rows.length === 0) {
        const err = new Error('Product not found');
        err.status = 404;
        throw err;
      }
      const productionTime = productInfo.rows[0]?.production_time;
      let expectedCompletionDate = null;
      if (start_time && productionTime > 0) {
        const st = new Date(start_time);
        expectedCompletionDate = new Date(st.getTime() + productionTime * 3600000).toISOString();
      }

      for (const mat of materials) {
        const matRow = await lockItem(client, 'material', mat.material_id);
        if (!matRow) {
          const err = new Error('Material not found');
          err.status = 404;
          throw err;
        }
        const availableStock = await getStockBalance(client, 'material', mat.material_id);
        if (Number(mat.used_qty) > availableStock) {
          const err = new Error(
            `Insufficient stock for "${matRow.name}" (Available: ${availableStock}, Required: ${mat.used_qty})`
          );
          err.status = 400;
          throw err;
        }
      }

      let expectedOutput = Infinity;
      for (const mat of materials) {
        const pm = await client.query(
          'SELECT quantity, unit FROM product_materials WHERE product_id = $1 AND material_id = $2',
          [product_id, mat.material_id]
        );
        if (pm.rows.length > 0 && pm.rows[0].quantity > 0) {
          const possible = mat.used_qty / pm.rows[0].quantity;
          if (possible < expectedOutput) expectedOutput = possible;
        }
      }
      if (expectedOutput === Infinity) expectedOutput = 0;

      const prodResult = await client.query(
        `INSERT INTO productions (product_id, status, started_by, expected_output, start_time, expected_completion_date, notes)
         VALUES ($1, 'In Progress', $2, $3, $4, $5, $6) RETURNING *`,
        [product_id, started_by || req.user.id, Math.floor(expectedOutput), start_time, expectedCompletionDate, notes]
      );
      const prod = prodResult.rows[0];

      for (const mat of materials) {
        const materialInfo = await client.query('SELECT name, unit FROM materials WHERE id = $1', [mat.material_id]);
        const requiredQty = await client.query(
          'SELECT quantity FROM product_materials WHERE product_id = $1 AND material_id = $2',
          [product_id, mat.material_id]
        );
        await client.query(
          `INSERT INTO production_materials_used (production_id, material_id, material_name, required_qty, used_qty, unit)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            prod.id,
            mat.material_id,
            materialInfo.rows[0]?.name || '',
            requiredQty.rows[0]?.quantity || 0,
            mat.used_qty,
            materialInfo.rows[0]?.unit || ''
          ]
        );
      }

      for (const mat of materials) {
        await client.query(
          `INSERT INTO stock_transactions (item_type, item_id, item_name, transaction_type, quantity, unit_price, reference_id, reference_type, created_by)
           VALUES ('material', $1, (SELECT name FROM materials WHERE id=$1), 'PRODUCTION_USE', 0 - $2, 0, $3, 'production', $4)`,
          [mat.material_id, mat.used_qty, prod.id, req.user.id]
        );
      }

      const productName = await client.query('SELECT name FROM products WHERE id = $1', [product_id]);
      const notif = await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [
          req.user.id,
          `Production #${prod.id} Started`,
          `Production of "${productName.rows[0]?.name}" has been started.${expectedCompletionDate ? ` Expected completion: ${new Date(expectedCompletionDate).toLocaleString()}.` : ''}`,
          'production'
        ]
      );

      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
         VALUES ($1, $2, 'Started production', 'production', $3, $4)`,
        [req.user.id, req.user.name, prod.id, `Product ID: ${product_id}`]
      );
      return { prod, notification: notif.rows[0] };
    });

    if (production.notification) notifyUser(production.notification.user_id, production.notification);
    broadcast('data', { entity: 'production', op: 'created', id: production.prod.id });
    broadcast('data', { entity: 'stock', op: 'changed' });
    broadcast('data', { entity: 'dashboard', op: 'changed' });
    res.status(201).json(production.prod);
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('POST /productions error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

const VALID_TRANSITIONS = {
  'In Progress': ['Completed', 'Cancelled'],
  'Pending Completion': ['Completed', 'Cancelled']
};

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const result = await withTx(async (client) => {
      const lock = await client.query('SELECT * FROM productions WHERE id = $1 FOR UPDATE', [id]);
      if (lock.rows.length === 0) {
        const err = new Error('Production not found');
        err.status = 404;
        throw err;
      }
      const prod = lock.rows[0];

      if (prod.status === status) {
        return { row: prod, noop: true };
      }

      const allowed = VALID_TRANSITIONS[prod.status];
      if (!allowed || !allowed.includes(status)) {
        const err = new Error(
          `Cannot transition from "${prod.status}" to "${status}". Allowed: ${(allowed || []).join(', ') || 'none'}`
        );
        err.status = 400;
        throw err;
      }

      const upd = await client.query(
        `UPDATE productions SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [status, notes, id]
      );

      if (status === 'Completed') {
        await lockItem(client, 'product', prod.product_id);
        await client.query(
          `INSERT INTO stock_transactions (item_type, item_id, item_name, transaction_type, quantity, unit_price, reference_id, reference_type, created_by)
           VALUES ('product', $1, (SELECT name FROM products WHERE id=$1), 'PRODUCTION', $2, 0, $3, 'production', $4)`,
          [prod.product_id, prod.expected_output || 0, id, req.user.id]
        );
      }

      if (status === 'Cancelled') {
        const used = await client.query(
          'SELECT material_id, used_qty FROM production_materials_used WHERE production_id = $1',
          [id]
        );
        for (const mat of used.rows) {
          await lockItem(client, 'material', mat.material_id);
          await client.query(
            `INSERT INTO stock_transactions (item_type, item_id, item_name, transaction_type, quantity, unit_price, reference_id, reference_type, created_by)
             VALUES ('material', $1, (SELECT name FROM materials WHERE id=$1), 'PRODUCTION_CANCEL', $2, 0, $3, 'production', $4)`,
            [mat.material_id, mat.used_qty, id, req.user.id]
          );
        }
      }

      const notif = await client.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.user.id, `Production ${status}`, `Production #${id} has been marked as "${status}".`, 'production']
      );

      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, 'production', $4, $5)`,
        [req.user.id, req.user.name, `Production ${status}`, id, `Status changed to ${status}`]
      );

      return { row: upd.rows[0], noop: false, notification: notif.rows[0] };
    });

    if (result.notification) notifyUser(result.notification.user_id, result.notification);
    if (!result.noop) {
      broadcast('data', { entity: 'production', op: 'updated', id: result.row.id });
      broadcast('data', { entity: 'stock', op: 'changed' });
      broadcast('data', { entity: 'dashboard', op: 'changed' });
    }
    res.json(result.row);
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('PUT /productions/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT status FROM productions WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Production not found' });
    if (result.rows[0].status !== 'Cancelled') {
      return res.status(400).json({ message: 'Only cancelled productions can be deleted' });
    }
    await pool.query('DELETE FROM productions WHERE id = $1', [id]);
    broadcast('data', { entity: 'production', op: 'deleted', id: Number(id) });
    broadcast('data', { entity: 'dashboard', op: 'changed' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /productions/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/notifications/list', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /notifications error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/notifications/read/all', async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE user_id = $1 AND read = TRUE', [req.user.id]);
    broadcast('data', { entity: 'notifications', op: 'updated', user_id: req.user.id });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /notifications/read/all error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    broadcast('data', { entity: 'notifications', op: 'updated', user_id: req.user.id });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /notifications/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    broadcast('data', { entity: 'notifications', op: 'updated', user_id: req.user.id });
    res.status(204).send();
  } catch (err) {
    console.error('PUT /notifications/:id/read error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
