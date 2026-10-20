import pg from 'pg';
import { DATABASE_URL } from './config.js';

const pool = new pg.Pool({
  connectionString: DATABASE_URL
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

export default pool;
