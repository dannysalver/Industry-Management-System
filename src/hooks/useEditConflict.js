import { useState, useCallback } from 'react';

export default function useEditConflict({ overwrite, mutate, onResolved, onError }) {
  const [conflict, setConflict] = useState(null);
  const [resolving, setResolving] = useState(false);

  const report = useCallback(
    (err, { id, pending }) => {
      if (err?.isConflict) {
        setConflict({ id, pending, current: err.current });
        return true;
      }
      onError?.(err);
      return false;
    },
    [onError]
  );

  const cancel = useCallback(() => setConflict(null), []);

  const reload = useCallback(async () => {
    setResolving(true);
    try {
      if (mutate) await mutate();
    } finally {
      setResolving(false);
      setConflict(null);
      onResolved?.({ action: 'reload' });
    }
  }, [mutate, onResolved]);

  const applyOverwrite = useCallback(async () => {
    if (!conflict) return;
    setResolving(true);
    try {
      await overwrite(conflict.id, conflict.pending, conflict.current.version);
      setConflict(null);
      onResolved?.({ action: 'overwrite' });
    } catch (err) {
      if (!report(err, conflict)) setConflict(null);
    } finally {
      setResolving(false);
    }
  }, [conflict, overwrite, onResolved, report]);

  return { conflict, resolving, report, cancel, reload, applyOverwrite };
}
