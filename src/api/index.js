const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/pages/login';
    }
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const error = new Error(body.message || `Request failed: ${res.status}`);
    error.status = res.status;
    if (res.status === 409 && body.code === 'VERSION_CONFLICT') {
      error.isConflict = true;
      error.current = body.current;
    }
    throw error;
  }

  if (res.status === 204) return null;
  return res.json();
}

export function get(endpoint) {
  return request(endpoint, { method: 'GET' });
}

export function post(endpoint, data, { idempotencyKey } = {}) {
  return request(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
  });
}

export function put(endpoint, data) {
  return request(endpoint, { method: 'PUT', body: JSON.stringify(data) });
}

export function del(endpoint) {
  return request(endpoint, { method: 'DELETE' });
}

export async function uploadFile(file, folder = '') {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('image', file);
  const url = folder ? `${API_BASE}/upload?folder=${folder}` : `${API_BASE}/upload`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` })
    },
    body: formData
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export default { get, post, put, del, uploadFile, newIdempotencyKey };
