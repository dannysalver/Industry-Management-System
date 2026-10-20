import { Router } from 'express';
import pool from '../db.js';
import authorize from '../middleware/authorize.js';

const router = Router();

router.get('/sales', authorize('Sales Officer', 'Accountant'), async (req, res) => {
  try {
    const { start_date, end_date, client_id } = req.query;
    let sql = `SELECT s.*, c.name as client_name, u.name as created_by_name FROM sales s LEFT JOIN clients c ON s.client_id = c.id LEFT JOIN users u ON s.created_by = u.id WHERE 1=1`;
    const params = [];
    if (start_date) { params.push(start_date); sql += ` AND s.created_at >= $${params.length}`; }
    if (end_date) { params.push(end_date); sql += ` AND s.created_at <= $${params.length}`; }
    if (client_id) { params.push(client_id); sql += ` AND s.client_id = $${params.length}`; }
    sql += ' ORDER BY s.created_at DESC';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /records/sales error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/expenses', authorize('Sales Officer', 'Accountant'), async (req, res) => {
  try {
    const { start_date, end_date, type } = req.query;
    let sql = `SELECT e.*, u.name as created_by_name FROM expenses e LEFT JOIN users u ON e.created_by = u.id WHERE 1=1`;
    const params = [];
    if (start_date) { params.push(start_date); sql += ` AND e.created_at >= $${params.length}`; }
    if (end_date) { params.push(end_date); sql += ` AND e.created_at <= $${params.length}`; }
    if (type) { params.push(type); sql += ` AND e.type = $${params.length}`; }
    sql += ' ORDER BY e.created_at DESC';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /records/expenses error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/production', authorize('Production Manager'), async (req, res) => {
  try {
    const { start_date, end_date, status } = req.query;
    let sql = `SELECT p.*, pr.name as product_name, u.name as started_by_name FROM productions p LEFT JOIN products pr ON p.product_id = pr.id LEFT JOIN users u ON p.started_by = u.id WHERE 1=1`;
    const params = [];
    if (start_date) { params.push(start_date); sql += ` AND p.created_at >= $${params.length}`; }
    if (end_date) { params.push(end_date); sql += ` AND p.created_at <= $${params.length}`; }
    if (status) { params.push(status); sql += ` AND p.status = $${params.length}`; }
    sql += ' ORDER BY p.created_at DESC';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /records/production error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/stock', authorize('Store Keeper', 'Production Manager'), async (req, res) => {
  try {
    const { start_date, end_date, item_type } = req.query;
    let sql = `SELECT st.*, u.name as created_by_name FROM stock_transactions st LEFT JOIN users u ON st.created_by = u.id WHERE 1=1`;
    const params = [];
    if (start_date) { params.push(start_date); sql += ` AND st.created_at >= $${params.length}`; }
    if (end_date) { params.push(end_date); sql += ` AND st.created_at <= $${params.length}`; }
    if (item_type) { params.push(item_type); sql += ` AND st.item_type = $${params.length}`; }
    sql += ' ORDER BY st.created_at DESC';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /records/stock error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/audit', async (req, res) => {
  try {
    const { start_date, end_date, user_id } = req.query;
    let sql = `SELECT * FROM audit_logs WHERE 1=1`;
    const params = [];
    if (start_date) { params.push(start_date); sql += ` AND created_at >= $${params.length}`; }
    if (end_date) { params.push(end_date); sql += ` AND created_at <= $${params.length}`; }
    if (user_id) { params.push(user_id); sql += ` AND user_id = $${params.length}`; }
    sql += ' ORDER BY created_at DESC';
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('GET /records/audit error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/sales/chart', async (req, res) => {
  try {
    const todayR = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales WHERE created_at::date = CURRENT_DATE`
    );

    const weekSales = await pool.query(
      `SELECT created_at::date AS d, SUM(total_amount) AS amt FROM sales
       WHERE created_at::date >= date_trunc('week', CURRENT_DATE)::date
       GROUP BY created_at::date ORDER BY d`
    );
    const weekDays = await pool.query(
      `SELECT d::date FROM generate_series(date_trunc('week', CURRENT_DATE)::date, CURRENT_DATE, '1 day') d`
    );
    const weekTotal = weekSales.rows.reduce((s, r) => s + Number(r.amt), 0);
    const weekSeries = weekDays.rows.map((day) => {
      const dStr = new Date(day.d).toISOString().slice(0, 10);
      const found = weekSales.rows.find((r) => new Date(r.d).toISOString().slice(0, 10) === dStr);
      return { day: new Date(day.d).toLocaleDateString('en', { weekday: 'short' }), amount: found ? Number(found.amt) : 0 };
    });

    const monthTotalR = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales
       WHERE created_at::date >= date_trunc('month', CURRENT_DATE)::date AND created_at::date <= CURRENT_DATE`
    );
    const monthSales = await pool.query(
      `SELECT CEIL(EXTRACT(DAY FROM created_at) / 7.0) AS wk, SUM(total_amount) AS amt FROM sales
       WHERE created_at::date >= date_trunc('month', CURRENT_DATE)::date AND created_at::date <= CURRENT_DATE
       GROUP BY wk ORDER BY wk`
    );
    const monthSeries = [1, 2, 3, 4].map((w) => {
      const found = monthSales.rows.find((r) => Number(r.wk) === w);
      return { week: 'W' + w, amount: found ? Number(found.amt) : 0 };
    });

    const yearSales = await pool.query(
      `SELECT date_trunc('month', created_at::date) AS mon, SUM(total_amount) AS amt FROM sales
       WHERE created_at::date >= date_trunc('year', CURRENT_DATE)::date
       GROUP BY mon ORDER BY mon`
    );
    const yearMonths = await pool.query(
      `SELECT m::date FROM generate_series(date_trunc('year', CURRENT_DATE)::date, CURRENT_DATE, '1 month') m`
    );
    const yearTotal = yearSales.rows.reduce((s, r) => s + Number(r.amt), 0);
    const yearSeries = yearMonths.rows.map((m) => {
      const mStr = new Date(m.m).toISOString().slice(0, 7);
      const found = yearSales.rows.find((r) => new Date(r.mon).toISOString().slice(0, 7) === mStr);
      return { month: new Date(m.m).toLocaleDateString('en', { month: 'short' }), amount: found ? Number(found.amt) : 0 };
    });

    res.json({
      today: { total: Number(todayR.rows[0].total) },
      week: { total: weekTotal, series: weekSeries },
      month: { total: Number(monthTotalR.rows[0].total), series: monthSeries },
      year: { total: yearTotal, series: yearSeries }
    });
  } catch (err) {
    console.error('GET /records/sales/chart error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/sales/today', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales WHERE created_at::date = CURRENT_DATE`
    );
    res.json({ total: Number(result.rows[0].total) });
  } catch (err) {
    console.error('GET /records/sales/today error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/expenses/chart', async (req, res) => {
  try {
    const todayR = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE created_at::date = CURRENT_DATE`
    );

    const weekExpenses = await pool.query(
      `SELECT created_at::date AS d, SUM(amount) AS amt FROM expenses
       WHERE created_at::date >= date_trunc('week', CURRENT_DATE)::date
       GROUP BY created_at::date ORDER BY d`
    );
    const weekDays = await pool.query(
      `SELECT d::date FROM generate_series(date_trunc('week', CURRENT_DATE)::date, CURRENT_DATE, '1 day') d`
    );
    const weekTotal = weekExpenses.rows.reduce((s, r) => s + Number(r.amt), 0);
    const weekSeries = weekDays.rows.map((day) => {
      const dStr = new Date(day.d).toISOString().slice(0, 10);
      const found = weekExpenses.rows.find((r) => new Date(r.d).toISOString().slice(0, 10) === dStr);
      return { day: new Date(day.d).toLocaleDateString('en', { weekday: 'short' }), amount: found ? Number(found.amt) : 0 };
    });

    const monthR = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
       WHERE created_at::date >= date_trunc('month', CURRENT_DATE)::date AND created_at::date <= CURRENT_DATE`
    );
    const monthData = await pool.query(
      `SELECT CEIL(EXTRACT(DAY FROM created_at) / 7.0) AS wk, SUM(amount) AS amt FROM expenses
       WHERE created_at::date >= date_trunc('month', CURRENT_DATE)::date AND created_at::date <= CURRENT_DATE
       GROUP BY wk ORDER BY wk`
    );
    const monthSeries = [1, 2, 3, 4].map((w) => {
      const found = monthData.rows.find((r) => Number(r.wk) === w);
      return { week: 'W' + w, amount: found ? Number(found.amt) : 0 };
    });

    const yearR = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
       WHERE created_at::date >= date_trunc('year', CURRENT_DATE)::date`
    );
    const yearData = await pool.query(
      `SELECT date_trunc('month', created_at::date) AS mon, SUM(amount) AS amt FROM expenses
       WHERE created_at::date >= date_trunc('year', CURRENT_DATE)::date
       GROUP BY mon ORDER BY mon`
    );
    const yearMonths = await pool.query(
      `SELECT m::date FROM generate_series(date_trunc('year', CURRENT_DATE)::date, CURRENT_DATE, '1 month') m`
    );
    const yearSeries = yearMonths.rows.map((m) => {
      const mStr = new Date(m.m).toISOString().slice(0, 7);
      const found = yearData.rows.find((r) => new Date(r.mon).toISOString().slice(0, 7) === mStr);
      return { month: new Date(m.m).toLocaleDateString('en', { month: 'short' }), amount: found ? Number(found.amt) : 0 };
    });

    res.json({
      today: { total: Number(todayR.rows[0].total) },
      week: { total: weekTotal, series: weekSeries },
      month: { total: Number(monthR.rows[0].total), series: monthSeries },
      year: { total: Number(yearR.rows[0].total), series: yearSeries }
    });
  } catch (err) {
    console.error('GET /records/expenses/chart error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/dashboard/summary', async (req, res) => {
  try {
    const totalEarnings = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales`
    );
    const totalOrders = await pool.query(
      `SELECT COUNT(*) AS count FROM sales`
    );
    const lowStock = await pool.query(
      `SELECT COUNT(*) AS count FROM materials WHERE stock_threshold > 0 AND
       COALESCE((SELECT SUM(quantity) FROM stock_transactions WHERE item_type='material' AND item_id=materials.id), 0) < stock_threshold`
    );
    const runningProductions = await pool.query(
      `SELECT COUNT(*) AS count FROM productions WHERE status = 'In Progress'`
    );
    const todayEarnings = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales WHERE created_at::date = CURRENT_DATE`
    );
    const todayExpensesR = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE created_at::date = CURRENT_DATE`
    );
    const monthEarnings = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales
       WHERE created_at::date >= date_trunc('month', CURRENT_DATE)::date`
    );
    const monthExpenses = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
       WHERE created_at::date >= date_trunc('month', CURRENT_DATE)::date`
    );
    const topProducts = await pool.query(
      `SELECT pr.name, SUM(si.quantity) AS qty, SUM(si.total_price) AS revenue
       FROM sale_items si JOIN products pr ON si.product_id = pr.id
        GROUP BY pr.id, pr.name ORDER BY revenue DESC LIMIT 3`
    );
    const recentSales = await pool.query(
      `SELECT s.total_amount, s.created_at, c.name AS client_name
       FROM sales s LEFT JOIN clients c ON s.client_id = c.id
       ORDER BY s.created_at DESC LIMIT 5`
    );
    const runningProductionsDetailed = await pool.query(
      `SELECT p.id, p.status, p.expected_output, p.start_time, p.expected_completion_date,
              pr.name AS product_name, u.name AS started_by_name
       FROM productions p
       LEFT JOIN products pr ON p.product_id = pr.id
       LEFT JOIN users u ON p.started_by = u.id
       WHERE p.status IN ('In Progress', 'Pending Completion')
       ORDER BY p.created_at DESC`
    );

    const monthProfit = Number(monthEarnings.rows[0].total) - Number(monthExpenses.rows[0].total);

    res.json({
      totalEarnings: Number(totalEarnings.rows[0].total),
      totalOrders: Number(totalOrders.rows[0].count),
      lowStock: Number(lowStock.rows[0].count),
      runningProductions: Number(runningProductions.rows[0].count),
      todayEarnings: Number(todayEarnings.rows[0].total),
      todayExpenses: Number(todayExpensesR.rows[0].total),
      monthEarnings: Number(monthEarnings.rows[0].total),
      monthExpenses: Number(monthExpenses.rows[0].total),
      monthProfit,
      topProducts: topProducts.rows,
      recentSales: recentSales.rows,
      runningProductionsDetailed: runningProductionsDetailed.rows
    });
  } catch (err) {
    console.error('GET /records/dashboard/summary error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
