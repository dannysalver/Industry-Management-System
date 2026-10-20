import { useCallback, useState } from 'react';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import useAppEvent from 'hooks/useAppEvent';

const SEVERITY = {
  production: 'info',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  error: 'error'
};

export default function LiveToaster() {
  const [toast, setToast] = useState(null);

  useAppEvent(
    'app:notification',
    useCallback((payload) => {
      if (!payload) return;
      setToast({ message: payload.message || payload.title || 'New notification', severity: SEVERITY[payload.type] || 'info' });
    }, [])
  );

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') return;
    setToast(null);
  };

  return (
    <Snackbar open={!!toast} autoHideDuration={6000} onClose={handleClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
      {toast ? (
        <Alert onClose={handleClose} severity={toast.severity} variant="filled" sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}
