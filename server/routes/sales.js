import { Router } from 'express';
import pool from '../db.js';
import { withTx } from '../lib/txn.js';
import { lockItem, getStockBalance } from '../lib/stock.js';
import { requireVersion, updateVersioned, sendConflict } from '../lib/optimistic.js';
import { beginIdempotency, findIdempotentResponse, completeIdempotency, idempotencyKey } from '../lib/idempotency.js';
import { broadcast } from '../lib/events.js';

const router = Router();

async function nextInvoiceNo(client) {
  const seq = await client.query(`SELECT nextval('invoice_seq') AS n`);
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `INV-${y}${m}${d}-${String(seq.rows[0].n).padStart(4, '0')}`;
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, c.name as client_name, u.name as created_by_name
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       LEFT JOIN users u ON s.created_by = u.id
       ORDER BY s.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /sales error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await pool.query(
      `SELECT s.*, c.name as client_name, u.name as created_by_name
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = $1`,
      [id]
    );
    if (sale.rows.length === 0) return res.status(404).json({ message: 'Sale not found' });
    const items = await pool.query(
      `SELECT si.*, p.name as product_name
       FROM sale_items si
       LEFT JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = $1`,
      [id]
    );
    res.json({ ...sale.rows[0], items: items.rows });
  } catch (err) {
    console.error('GET /sales/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { client_id, items, discount, payment_method } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one sale item is required' });
    }

    const idemKey = idempotencyKey(req);

    const sale = await withTx(async (client) => {
      if (idemKey) {
        const inserted = await beginIdempotency(client, idemKey, req.user.id, 'POST /sales');
        if (!inserted) {
          const existing = await findIdempotentResponse(client, idemKey, req.user.id);
          const err = new Error(
            existing?.status === 'done'
              ? 'Duplicate submission'
              : 'A submission with this key is already being processed'
          );
          err.status = 409;
          err.duplicate = existing?.status === 'done' ? existing.response : null;
          throw err;
        }
      }

      for (const item of items) {
        const product = await lockItem(client, 'product', item.product_id);
        if (!product) {
          const err = new Error('Product not found');
          err.status = 404;
          throw err;
        }
        const available = await getStockBalance(client, 'product', item.product_id);
        if (Number(item.quantity) > available) {
          const err = new Error(
            `Insufficient stock for "${product.name}" (Available: ${available}, Required: ${item.quantity})`
          );
          err.status = 400;
          throw err;
        }
      }

      let total = 0;
      for (const item of items) {
        total += Number(item.quantity) * Number(item.unit_price);
      }
      total -= Number(discount || 0);

      const invoiceNo = await nextInvoiceNo(client);
      const saleResult = await client.query(
        `INSERT INTO sales (invoice_no, client_id, total_amount, discount, payment_method, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [invoiceNo, client_id, total, discount || 0, payment_method, req.user.id]
      );
      const row = saleResult.rows[0];

      for (const item of items) {
        await client.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [row.id, item.product_id, item.quantity, item.unit_price, Number(item.quantity) * Number(item.unit_price)]
        );
        await client.query(
          `INSERT INTO stock_transactions (item_type, item_id, item_name, transaction_type, quantity, unit_price, reference_id, reference_type, created_by)
           VALUES ('product', $1, (SELECT name FROM products WHERE id=$1), 'SALE', 0 - $2, $3, $4, 'sale', $5)`,
          [item.product_id, item.quantity, item.unit_price, row.id, req.user.id]
        );
      }

      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
         VALUES ($1, $2, 'Created sale', 'sale', $3, $4)`,
        [req.user.id, req.user.name, row.id, `Total: ${total}`]
      );

      if (idemKey) await completeIdempotency(client, idemKey, row);
      return row;
    });

    broadcast('data', { entity: 'sales', op: 'created', id: sale.id });
    broadcast('data', { entity: 'stock', op: 'changed' });
    broadcast('data', { entity: 'records', op: 'changed' });
    broadcast('data', { entity: 'dashboard', op: 'changed' });
    res.status(201).json(sale);
  } catch (err) {
    if (err.status === 409 && err.duplicate) {
      return res.status(200).json(err.duplicate);
    }
    if (err.status === 400 || err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error('POST /sales error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { client_id, total_amount, discount, payment_method } = req.body;
    const expectedVersion = requireVersion(req.body);

    const updated = await withTx(async (client) => {
      const row = await updateVersioned(
        client,
        'sales',
        id,
        'client_id=$1, total_amount=$2, discount=$3, payment_method=$4',
        [client_id, total_amount, discount, payment_method],
        expectedVersion
      );
      await client.query(
        `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
         VALUES ($1, $2, 'Updated sale', 'sale', $3, $4)`,
        [req.user.id, req.user.name, id, `Total: ${total_amount}`]
      );
      return row;
    });

    broadcast('data', { entity: 'sales', op: 'updated', id: updated.id });
    broadcast('data', { entity: 'records', op: 'changed' });
    res.json(updated);
  } catch (err) {
    if (sendConflict(res, err)) return;
    console.error('PUT /sales/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM sales WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Sale not found' });
    broadcast('data', { entity: 'sales', op: 'deleted', id: Number(id) });
    broadcast('data', { entity: 'records', op: 'changed' });
    broadcast('data', { entity: 'dashboard', op: 'changed' });
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /sales error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
