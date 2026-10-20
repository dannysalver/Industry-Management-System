import { useEffect, useRef } from 'react';

export default function useAppEvent(name, handler) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const listener = (e) => ref.current(e.detail);
    window.addEventListener(name, listener);
    return () => window.removeEventListener(name, listener);
  }, [name]);
}
