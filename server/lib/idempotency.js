export async function beginIdempotency(client, key, userId, endpoint) {
  if (!key) return false;
  const result = await client.query(
    `INSERT INTO idempotency_keys (key, user_id, endpoint, status, response)
     VALUES ($1, $2, $3, 'in_progress', '{}'::jsonb)
     ON CONFLICT (key) DO NOTHING
     RETURNING key`,
    [key, userId, endpoint]
  );
  return result.rows.length > 0;
}

export async function findIdempotentResponse(client, key, userId) {
  if (!key) return null;
  const result = await client.query(
    `SELECT status, response FROM idempotency_keys WHERE key = $1 AND user_id = $2`,
    [key, userId]
  );
  return result.rows[0] || null;
}

export async function completeIdempotency(client, key, response) {
  if (!key) return;
  await client.query(`UPDATE idempotency_keys SET status = 'done', response = $2 WHERE key = $1`, [
    key,
    JSON.stringify(response)
  ]);
}

export function idempotencyKey(req) {
  const raw = req.headers['idempotency-key'];
  if (!raw) return null;
  const key = String(raw).trim();
  return key.length > 0 && key.length <= 100 ? key : null;
}
