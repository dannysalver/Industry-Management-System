import { Router } from 'express';
import jwt from 'jsonwebtoken';
import auth from '../middleware/auth.js';
import {
  addClient,
  broadcast,
  onlineUsers,
  activeEditors,
  setEditing,
  clearEditing,
  clearEditingByUser
} from '../lib/events.js';
import { JWT_SECRET } from '../config.js';

const router = Router();

router.get('/', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ message: 'No token provided' });

  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`event: hello\ndata: ${JSON.stringify({ online: onlineUsers(), editing: activeEditors() })}\n\n`);

  const remove = addClient(user.id, user.name, res);
  broadcast('presence:changed', { online: onlineUsers() });

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      /* closed; 'close' handler will clean up */
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    remove();
    clearEditingByUser(user.id);
    broadcast('presence:changed', { online: onlineUsers() });
  });
});

router.get('/presence', auth, (req, res) => {
  res.json({ online: onlineUsers(), editing: activeEditors() });
});

router.put('/editing', auth, (req, res) => {
  const { entity_type, entity_id } = req.body || {};
  if (!entity_type || !entity_id) {
    return res.status(400).json({ message: 'entity_type and entity_id are required' });
  }
  setEditing(String(entity_type), Number(entity_id), req.user.id, req.user.name);
  broadcast('presence:changed', { editing: activeEditors() });
  res.status(204).send();
});

router.delete('/editing/:type/:id', auth, (req, res) => {
  clearEditing(req.params.type, Number(req.params.id), req.user.id);
  broadcast('presence:changed', { editing: activeEditors() });
  res.status(204).send();
});

export default router;
