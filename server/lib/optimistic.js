export class ConflictError extends Error {
  constructor(current) {
    super('This record was modified by another user while you were editing it');
    this.name = 'ConflictError';
    this.code = 'VERSION_CONFLICT';
    this.current = current;
  }
}

export function requireVersion(body) {
  const v = Number(body?.version);
  if (!Number.isInteger(v) || v < 1) {
    const err = new Error('Missing or invalid "version" field — reload the record and try again');
    err.status = 400;
    throw err;
  }
  return v;
}

export async function updateVersioned(client, table, id, setClause, params, expectedVersion) {
  const result = await client.query(
    `UPDATE ${table} SET ${setClause}, version = version + 1
     WHERE id = $${params.length + 1} AND version = $${params.length + 2}
     RETURNING *`,
    [...params, id, expectedVersion]
  );
  if (result.rows.length === 0) {
    const cur = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    if (cur.rows.length === 0) {
      const err = new Error('Record not found');
      err.status = 404;
      throw err;
    }
    throw new ConflictError(cur.rows[0]);
  }
  return result.rows[0];
}

export function sendConflict(res, err) {
  if (err instanceof ConflictError || err.code === 'VERSION_CONFLICT') {
    res.status(409).json({ code: 'VERSION_CONFLICT', message: err.message, current: err.current });
    return true;
  }
  if (err.status === 400) {
    res.status(400).json({ message: err.message });
    return true;
  }
  if (err.status === 404) {
    res.status(404).json({ message: err.message });
    return true;
  }
  return false;
}
