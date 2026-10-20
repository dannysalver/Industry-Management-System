import { EventEmitter } from 'events';

class EventBus extends EventEmitter {}

export const bus = new EventBus();
bus.setMaxListeners(0);

const clients = new Map();

export function addClient(userId, userName, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  const entry = { res, userId, userName };
  clients.get(userId).add(entry);
  return () => {
    const set = clients.get(userId);
    if (set) {
      set.delete(entry);
      if (set.size === 0) clients.delete(userId);
    }
  };
}

export function broadcast(event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const set of clients.values()) {
    for (const c of set) {
      try {
        c.res.write(data);
      } catch {
        /* client gone; close handler will clean up */
      }
    }
  }
}

export function notifyUser(userId, payload) {
  const set = clients.get(userId);
  if (!set) return;
  const data = `event: notification\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const c of set) {
    try {
      c.res.write(data);
    } catch {
      /* client gone; close handler will clean up */
    }
  }
}

export function onlineUsers() {
  const seen = new Map();
  for (const [userId, set] of clients) {
    if (set.size === 0) continue;
    const any = set.values().next().value;
    seen.set(userId, any.userName);
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}

const PRESENCE_TTL = 60000;
const editing = new Map();

function sweep() {
  const now = Date.now();
  for (const [key, val] of editing) {
    if (val.expiresAt < now) editing.delete(key);
  }
}

export function setEditing(entityType, entityId, userId, userName) {
  sweep();
  editing.set(`${entityType}:${entityId}`, { userId, userName, expiresAt: Date.now() + PRESENCE_TTL });
}

export function clearEditing(entityType, entityId, userId) {
  const key = `${entityType}:${entityId}`;
  const cur = editing.get(key);
  if (cur && cur.userId === userId) editing.delete(key);
}

export function clearEditingByUser(userId) {
  for (const [key, val] of editing) {
    if (val.userId === userId) editing.delete(key);
  }
}

export function activeEditors() {
  sweep();
  return [...editing.entries()].map(([key, val]) => {
    const sep = key.indexOf(':');
    return {
      entity_type: key.slice(0, sep),
      entity_id: Number(key.slice(sep + 1)),
      user_id: val.userId,
      user_name: val.userName,
      expires_at: val.expiresAt
    };
  });
}
