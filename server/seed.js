import bcrypt from 'bcryptjs';
import pool from './db.js';

async function seed() {
  try {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      `INSERT INTO users (name, email, password, role_id)
       VALUES ('Admin', 'admin@nimr.com', $1, 1)
       ON CONFLICT (email) DO UPDATE SET password = $1`,
      [hash]
    );
    console.log('Admin user created: admin@nimr.com / admin123');
  } catch (err) {
    console.error('Seed failed:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
