import { useEffect } from 'react';
import { mutate } from 'swr';

const ENDPOINT_MAP = {
  materials: ['/materials'],
  products: ['/products'],
  clients: ['/clients'],
  suppliers: ['/suppliers'],
  expenses: ['/expenses'],
  sales: ['/sales'],
  production: ['/productions'],
  stock: ['/stock', '/stock?item_type=material', '/stock?item_type=product', '/stock/items/material', '/stock/items/product']
};

function parse(e) {
  try {
    return JSON.parse(e.data);
  } catch {
    return null;
  }
}

export default function useEvents() {
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return undefined;

    const source = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

    const onData = (e) => {
      const payload = parse(e);
      if (!payload) return;
      for (const key of ENDPOINT_MAP[payload.entity] || []) {
        mutate(key);
      }
      window.dispatchEvent(new CustomEvent('app:data', { detail: payload }));
    };

    const onNotification = (e) => {
      const payload = parse(e);
      if (!payload) return;
      window.dispatchEvent(new CustomEvent('app:notification', { detail: payload }));
    };

    const onPresence = (e) => {
      const payload = parse(e);
      if (payload) window.dispatchEvent(new CustomEvent('app:presence', { detail: payload }));
    };

    source.addEventListener('data', onData);
    source.addEventListener('notification', onNotification);
    source.addEventListener('presence:changed', onPresence);
    source.addEventListener('hello', onPresence);

    return () => {
      source.removeEventListener('data', onData);
      source.removeEventListener('notification', onNotification);
      source.removeEventListener('presence:changed', onPresence);
      source.removeEventListener('hello', onPresence);
      source.close();
    };
  }, []);
}
