import pool from './db.js';

async function deduplicateTable(table, nameColumn) {
  const dupes = await pool.query(
    `SELECT ${nameColumn}, MIN(id) AS keep_id, COUNT(*)
     FROM ${table}
     GROUP BY ${nameColumn}
     HAVING COUNT(*) > 1`
  );
  for (const row of dupes.rows) {
    await pool.query(
      `DELETE FROM ${table} WHERE ${nameColumn} = $1 AND id != $2`,
      [row[nameColumn], row.keep_id]
    );
  }
  if (dupes.rows.length > 0) console.log(`Deduplicated ${table}: removed ${dupes.rows.length} groups`);
}

async function migrateUpdate() {
  try {
    // ---------- material_type ----------
    await pool.query(`ALTER TABLE material_type ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'liquid'`);
    console.log('Added category column to material_type');

    // Deduplicate before adding unique constraint
    await deduplicateTable('material_type', 'name');

    // Add unique constraint if missing
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'material_type_name_key') THEN
          ALTER TABLE material_type ADD UNIQUE (name);
        END IF;
      END $$;
    `);
    console.log('Added UNIQUE on material_type(name)');

    await pool.query(`
      INSERT INTO material_type (name, category) VALUES
        ('Solid', 'solid'),
        ('Liquid', 'liquid'),
        ('Powder', 'solid'),
        ('Granule', 'solid'),
        ('Concentrate', 'liquid'),
        ('Solvent', 'liquid')
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('Seeded material types');

    // ---------- materials type column ----------
    await pool.query(`ALTER TABLE materials ALTER COLUMN type DROP DEFAULT`);
    await pool.query(`ALTER TABLE materials ALTER COLUMN type TYPE INT USING NULL`);
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'materials_type_fkey') THEN
          ALTER TABLE materials ADD CONSTRAINT materials_type_fkey FOREIGN KEY (type) REFERENCES material_type(id);
        END IF;
      END $$;
    `);
    console.log('Updated materials.type to integer reference');

    await pool.query(`ALTER TABLE materials DROP COLUMN IF EXISTS description`);
    await pool.query(`ALTER TABLE materials DROP COLUMN IF EXISTS stock_quantity`);
    await pool.query(`ALTER TABLE materials ADD COLUMN IF NOT EXISTS stock_threshold INT DEFAULT 0`);
    console.log('Added stock_threshold column to materials');

    // ---------- product_type ----------
    await deduplicateTable('product_type', 'name');

    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'product_type_name_key') THEN
          ALTER TABLE product_type ADD UNIQUE (name);
        END IF;
      END $$;
    `);
    console.log('Added UNIQUE on product_type(name)');

    await pool.query(`
      INSERT INTO product_type (name) VALUES
        ('Tablet'), ('Capsule'), ('Syrup'), ('Suspension'),
        ('Injection'), ('Cream'), ('Ointment'), ('Solution')
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('Seeded product types');

    // ---------- products type column ----------
    await pool.query(`ALTER TABLE products ALTER COLUMN type DROP DEFAULT`);
    await pool.query(`ALTER TABLE products ALTER COLUMN type TYPE INT USING NULL`);
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'products_type_fkey') THEN
          ALTER TABLE products ADD CONSTRAINT products_type_fkey FOREIGN KEY (type) REFERENCES product_type(id);
        END IF;
      END $$;
    `);
    console.log('Updated products.type to integer reference');

    await pool.query(`ALTER TABLE products DROP COLUMN IF EXISTS description`);
    console.log('Dropped description column from products');

    // ---------- productions ----------
    await pool.query(`ALTER TABLE productions DROP COLUMN IF EXISTS wastage`);
    await pool.query(`ALTER TABLE productions DROP COLUMN IF EXISTS quantity`);
    await pool.query(`ALTER TABLE productions ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE productions ADD COLUMN IF NOT EXISTS expected_completion_date TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE productions ALTER COLUMN status SET DEFAULT 'In Progress'`);
    console.log('Updated productions table schema');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS production_materials_used (
        id SERIAL PRIMARY KEY,
        production_id INT REFERENCES productions(id) ON DELETE CASCADE,
        material_id INT REFERENCES materials(id),
        material_name VARCHAR(255),
        required_qty DECIMAL(12,2),
        used_qty DECIMAL(12,2) NOT NULL,
        unit VARCHAR(50),
        UNIQUE(production_id, material_id)
      )
    `);
    console.log('Created production_materials_used table');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        message TEXT,
        type VARCHAR(50) DEFAULT 'info',
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('Created notifications table');

    // ---------- sales ----------
    await pool.query(`ALTER TABLE sales DROP COLUMN IF EXISTS notes`);
    await pool.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(50)`);
    console.log('Updated sales: removed notes, added invoice_no');

    // ---------- expenses ----------
    await pool.query(`ALTER TABLE expenses DROP COLUMN IF EXISTS description`);
    await pool.query(`ALTER TABLE expenses DROP COLUMN IF EXISTS category`);
    await pool.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE`);
    console.log('Updated expenses: removed description/category, added date column');

    // ---------- supplier_materials ----------
    await pool.query(`ALTER TABLE supplier_materials ADD COLUMN IF NOT EXISTS unit VARCHAR(50)`);
    await pool.query(`ALTER TABLE supplier_materials DROP COLUMN IF EXISTS price`);
    await pool.query(`ALTER TABLE supplier_materials ADD COLUMN IF NOT EXISTS price_per_unit DECIMAL(12,2)`);
    console.log('Updated supplier_materials: added unit, renamed price to price_per_unit');

    // ---------- permissions + role_permissions ----------
    await pool.query(`
      INSERT INTO permissions (permission) VALUES
        ('admin'), ('stock'), ('production'), ('sales')
      ON CONFLICT DO NOTHING
    `);
    console.log('Seeded permissions');
    await pool.query(`
      INSERT INTO role_permissions (role_id, permission_id) VALUES
        (1, 1), (2, 3), (3, 4), (4, 2), (5, 4)
      ON CONFLICT DO NOTHING
    `);
    console.log('Seeded role_permissions');

    // ---------- users avatar ----------
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(500)`);
    console.log('Added avatar column to users');

    // ---------- concurrency: optimistic locking versions ----------
    for (const table of ['users', 'materials', 'products', 'clients', 'suppliers', 'sales', 'expenses']) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1`);
    }
    console.log('Added version columns for optimistic locking');

    // ---------- concurrency: server-side invoice sequence ----------
    await pool.query(`CREATE SEQUENCE IF NOT EXISTS invoice_seq`);
    console.log('Created invoice_seq sequence');

    // ---------- concurrency: idempotency keys ----------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        user_id INT REFERENCES users(id),
        endpoint VARCHAR(255),
        status VARCHAR(20) DEFAULT 'in_progress',
        response JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('Created idempotency_keys table');
  } catch (err) {
    console.error('Migration update failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrateUpdate();
