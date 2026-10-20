import { useState, useEffect, useCallback } from 'react';
import { put, del } from 'api';
import useAuth from 'hooks/useAuth';
import useAppEvent from 'hooks/useAppEvent';

const HEARTBEAT_MS = 25000;

export function usePresence() {
  const [editing, setEditing] = useState([]);

  useAppEvent(
    'app:presence',
    useCallback((detail) => {
      if (detail && Array.isArray(detail.editing)) setEditing(detail.editing);
    }, [])
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return undefined;
    let cancelled = false;
    fetch('/api/events/presence', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.editing) setEditing(data.editing);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return editing;
}

export function useEditingPresence(entityType, entityId, enabled) {
  useEffect(() => {
    if (!enabled || !entityId) return undefined;
    let active = true;

    const ping = () => {
      if (active) put('/events/editing', { entity_type: entityType, entity_id: entityId }).catch(() => {});
    };

    ping();
    const interval = setInterval(ping, HEARTBEAT_MS);

    return () => {
      active = false;
      clearInterval(interval);
      del(`/events/editing/${encodeURIComponent(entityType)}/${entityId}`).catch(() => {});
    };
  }, [entityType, entityId, enabled]);
}

export function useRecordEditors(entityType, entityId, excludeUserId) {
  const editing = usePresence();
  return editing.filter((e) => e.entity_type === entityType && Number(e.entity_id) === Number(entityId) && e.user_id !== excludeUserId);
}

export function useCurrentUserId() {
  const { user } = useAuth();
  return user?.id ?? null;
}

export default usePresence;
