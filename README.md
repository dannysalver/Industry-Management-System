# IDMS - Production Management System

A full-stack manufacturing ERP for **NIMR Mabibo**. It tracks raw materials, product
recipes, production batches, stock movements, sales, expenses, suppliers, clients and
users, with role-based access and live multi-user synchronisation.

---

## Features

- **Dashboard** - sales, stock, expenditure and income charts, plus summary cards.
- **Materials & Products** - raw materials and finished goods with images, types,
  prices and per-product recipes (bill of materials).
- **Production** - start production batches, consume raw materials, compute expected
  output and track status (`In Progress`, `Pending Completion`, `Completed`, `Cancelled`).
- **Stock** - stock-in / stock-out ledger for materials and products with low-stock alerts.
- **Sales** - multi-line invoices with server-generated invoice numbers, automatic stock
  deduction and payment method.
- **Expenses, Suppliers (Sources) and Clients** - procurement and customer management.
- **Records & Reports** - view and export sales, expenditure, production, stock and audit
  logs to Excel.
- **Users & Roles** - admin user management with five roles (see below).
- **Live collaboration** - Server-Sent Events push updates to every open tab, an edit
  conflict dialog protects against lost updates, and a presence indicator shows who is
  editing a record.
- **Concurrency safety** - transactional stock updates (no overselling) and optimistic
  locking on all editable records.

## Tech Stack

| Layer     | Technology                                                        |
| --------- | ----------------------------------------------------------------- |
| Frontend  | React 19, Vite 7, MUI 7, React Router 7, SWR, Axios-style `fetch` |
| Backend   | Node.js (ESM), Express 4, PostgreSQL (`pg`), JWT, bcryptjs, multer |
| Tooling   | ESLint, Prettier, Yarn 4                                           |

The UI is built on the [Berry Material React](https://github.com/codedthemes/berry-free-react-admin-template) template.

## Project Structure

```
.
├── src/                  # React frontend
│   ├── api/              # data hooks and HTTP client
│   ├── hooks/            # reusable hooks (SWR, live events, presence, conflicts)
│   ├── layout/           # application shell, header, sidebar
│   ├── menu-items/       # sidebar navigation (role aware)
│   ├── routes/           # route definitions
│   ├── ui-component/     # shared UI components (DataTable, FormDialog, ...)
│   ├── views/            # feature pages
│   └── themes/           # MUI theme
├── server/               # Express API
│   ├── lib/              # transaction, stock, optimistic-lock, events, idempotency helpers
│   ├── middleware/       # auth and role authorization
│   ├── routes/           # REST endpoints per entity
│   ├── schema.sql        # database schema
│   ├── migrate.js        # run schema.sql
│   ├── seed.js           # seed default roles/users
│   └── index.js          # server entry point
├── storage/uploads/      # uploaded images (not committed)
├── .env.example          # frontend env template
└── server/.env.example   # backend env template
```

## Prerequisites

- Node.js 20.6+ (required by Vite 7 and `node --env-file`)
- Yarn 4 (via Corepack) or npm
- PostgreSQL 14+

## Getting Started

### 1. Backend

```bash
cd server
npm install

# create the environment file and edit the values
cp .env.example .env

# create the schema and seed the default data
npm run migrate
npm run seed

# start the API (http://localhost:5000)
npm run dev
```

### 2. Frontend

```bash
# from the project root
yarn install

cp .env.example .env   # optional for local development

yarn start             # http://localhost:3000
```

Vite proxies `/api` and `/storage` to `http://localhost:5000`, so the frontend and
backend run side by side.

## Environment Variables

### Frontend (`.env`)

| Variable             | Description                              |
| -------------------- | ---------------------------------------- |
| `VITE_APP_BASE_NAME` | Base path (empty for local development)  |
| `VITE_APP_VERSION`   | Displayed application version            |
| `GENERATE_SOURCEMAP` | Emit source maps on build                |

### Backend (`server/.env`)

| Variable       | Description                                              |
| -------------- | -------------------------------------------------------- |
| `PORT`         | API port (default `5000`)                                |
| `DATABASE_URL` | PostgreSQL connection string                             |
| `JWT_SECRET`   | Secret used to sign auth tokens (use a long random value) |

> **Never commit real `.env` files.** Only the `.env.example` templates belong in Git.

## Available Scripts

### Frontend (root)

| Command        | Description                     |
| -------------- | ------------------------------- |
| `yarn start`   | Start the dev server on `:3000` |
| `yarn build`   | Production build to `dist/`     |
| `yarn lint`    | Run ESLint                      |
| `yarn prettier`| Format source files             |

### Backend (`server/`)

| Command                 | Description                            |
| ----------------------- | -------------------------------------- |
| `npm run dev`           | Start with watch mode and `.env`       |
| `npm start`             | Start the API                          |
| `npm run migrate`       | Apply `schema.sql`                     |
| `npm run migrate:update`| Apply incremental schema updates       |
| `npm run seed`          | Seed roles, users and sample data      |
| `npm run reset`         | Reset transactional data               |

## Roles & Permissions

| Role               | Access                                                        |
| ------------------ | ------------------------------------------------------------- |
| Admin              | Everything, including user management                         |
| Production Manager | Materials, products, production, stock and records            |
| Store Keeper       | Materials, products, stock and records                        |
| Sales Officer      | Sales, expenses, suppliers, clients and records               |
| Accountant         | Sales, expenses, suppliers, clients and records               |


