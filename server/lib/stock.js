const TABLES = { material: 'materials', product: 'products' };

export function itemTable(itemType) {
  const table = TABLES[itemType];
  if (!table) {
    const err = new Error(`Invalid item type "${itemType}" (use "material" or "product")`);
    err.status = 400;
    throw err;
  }
  return table;
}

export async function lockItem(client, itemType, itemId) {
  const table = itemTable(itemType);
  const result = await client.query(`SELECT * FROM ${table} WHERE id = $1 FOR UPDATE`, [itemId]);
  return result.rows[0] || null;
}

export async function getStockBalance(client, itemType, itemId) {
  const result = await client.query(
    `SELECT COALESCE(SUM(quantity), 0) AS qty FROM stock_transactions WHERE item_type = $1 AND item_id = $2`,
    [itemType, itemId]
  );
  return Number(result.rows[0].qty);
}
