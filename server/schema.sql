-- IDMS Database Schema

-- Concurrency support: server-wide invoice sequence + duplicate-submit protection
CREATE SEQUENCE IF NOT EXISTS invoice_seq;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id INT REFERENCES users(id),
  endpoint VARCHAR(255),
  status VARCHAR(20) DEFAULT 'in_progress',
  response JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  role VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  permission VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INT REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role_id INT REFERENCES roles(id),
  avatar VARCHAR(500),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_type (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(50) DEFAULT 'liquid',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type INT REFERENCES material_type(id),
  unit VARCHAR(50) NOT NULL,
  price_per_unit DECIMAL(12,2) NOT NULL,
  stock_threshold INT DEFAULT 0,
  image_url VARCHAR(500),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact VARCHAR(255),
  email VARCHAR(255),
  address TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_type (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type INT REFERENCES product_type(id),
  price DECIMAL(12,2) NOT NULL,
  production_time INT,
  expiry_days INT,
  image_url VARCHAR(500),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_materials (
  id SERIAL PRIMARY KEY,
  product_id INT REFERENCES products(id) ON DELETE CASCADE,
  material_id INT REFERENCES materials(id) ON DELETE CASCADE,
  quantity DECIMAL(12,2) NOT NULL,
  unit VARCHAR(50),
  UNIQUE(product_id, material_id)
);

CREATE TABLE IF NOT EXISTS productions (
  id SERIAL PRIMARY KEY,
  product_id INT REFERENCES products(id),
  status VARCHAR(50) DEFAULT 'In Progress',
  started_by INT REFERENCES users(id),
  expected_output DECIMAL(12,2),
  start_time TIMESTAMPTZ,
  expected_completion_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_materials_used (
  id SERIAL PRIMARY KEY,
  production_id INT REFERENCES productions(id) ON DELETE CASCADE,
  material_id INT REFERENCES materials(id),
  material_name VARCHAR(255),
  required_qty DECIMAL(12,2),
  used_qty DECIMAL(12,2) NOT NULL,
  unit VARCHAR(50),
  UNIQUE(production_id, material_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(50) DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id SERIAL PRIMARY KEY,
  item_type VARCHAR(50),
  item_id INT,
  item_name VARCHAR(255),
  transaction_type VARCHAR(50),
  quantity DECIMAL(12,2) NOT NULL,
  unit_price DECIMAL(12,2),
  reference_id INT,
  reference_type VARCHAR(50),
  notes TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) DEFAULT 'Walk-in Customer',
  contact VARCHAR(255),
  email VARCHAR(255),
  address TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  invoice_no VARCHAR(50) UNIQUE,
  client_id INT REFERENCES clients(id),
  total_amount DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) DEFAULT 0,
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) DEFAULT 'Paid',
  created_by INT REFERENCES users(id),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INT REFERENCES sales(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id),
  quantity DECIMAL(12,2) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS client_payments (
  id SERIAL PRIMARY KEY,
  client_id INT REFERENCES clients(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(50),
  status VARCHAR(50) DEFAULT 'Partial',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  type VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  created_by INT REFERENCES users(id),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sites (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  contact VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  user_name VARCHAR(255),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id INT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_materials (
  id SERIAL PRIMARY KEY,
  supplier_id INT REFERENCES suppliers(id) ON DELETE CASCADE,
  material_id INT REFERENCES materials(id) ON DELETE CASCADE,
  unit VARCHAR(50),
  price_per_unit DECIMAL(12,2),
  UNIQUE(supplier_id, material_id)
);

-- Seed default roles
INSERT INTO roles (role) VALUES
  ('Admin'),
  ('Production Manager'),
  ('Sales Officer'),
  ('Store Keeper'),
  ('Accountant')
ON CONFLICT DO NOTHING;

-- Seed permissions
INSERT INTO permissions (permission) VALUES
  ('admin'),
  ('stock'),
  ('production'),
  ('sales')
ON CONFLICT DO NOTHING;

-- Map roles to permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
  (1, 1),
  (2, 3),
  (3, 4),
  (4, 2),
  (5, 4)
ON CONFLICT DO NOTHING;

-- Seed material types
INSERT INTO material_type (name, category) VALUES
  ('Solid', 'solid'),
  ('Liquid', 'liquid'),
  ('Powder', 'solid'),
  ('Granule', 'solid'),
  ('Concentrate', 'liquid'),
  ('Solvent', 'liquid')
ON CONFLICT DO NOTHING;

-- Seed product types
INSERT INTO product_type (name) VALUES
  ('Tablet'),
  ('Capsule'),
  ('Syrup'),
  ('Suspension'),
  ('Injection'),
  ('Cream'),
  ('Ointment'),
  ('Solution')
ON CONFLICT DO NOTHING;
