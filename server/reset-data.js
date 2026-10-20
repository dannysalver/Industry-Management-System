import pool from './db.js';

async function resetData() {
  try {
    console.log('Resetting production-related tables...');
    await pool.query('DELETE FROM notifications');
    await pool.query('DELETE FROM audit_logs WHERE entity_type IN (\'production\', \'product\', \'material\')');
    await pool.query('DELETE FROM production_materials_used');
    await pool.query('DELETE FROM productions');
    await pool.query('DELETE FROM product_materials');
    await pool.query('DELETE FROM products');
    await pool.query('DELETE FROM materials');
    console.log('All production data reset successfully');
  } catch (err) {
    console.error('Reset failed:', err.message);
  } finally {
    await pool.end();
  }
}

resetData();
