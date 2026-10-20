import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import { IconAlertTriangle } from '@tabler/icons-react';

const IGNORED = ['id', 'version', 'created_at', 'updated_at', 'type', 'type_name', 'category', 'image_url', 'materials'];

function changedFields(pending, current) {
  if (!pending || !current) return [];
  const keys = new Set([...Object.keys(pending), ...Object.keys(current)]);
  const changes = [];
  for (const key of keys) {
    if (IGNORED.includes(key)) continue;
    const a = pending[key];
    const b = current[key];
    if (a === undefined || a === null || a === '') continue;
    if (String(a) !== String(b)) changes.push({ key, mine: a, theirs: b });
  }
  return changes;
}

export default function ConflictDialog({ open, onClose, onReload, onOverwrite, entityLabel = 'record', pending, current, loading }) {
  const changes = changedFields(pending, current);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconAlertTriangle color="#ed6c02" />
        Edit conflict
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="warning" sx={{ mb: 2 }}>
          This {entityLabel} was modified by another user while you were editing it. Your version is now out of date.
        </Alert>

        {changes.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Your unsaved values
            </Typography>
            <Stack spacing={1}>
              {changes.map((c) => (
                <Box key={c.key} sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                    {c.key.replace(/_/g, ' ')}
                  </Typography>
                  <Typography variant="body2">
                    Your value: <strong>{String(c.mine)}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Latest on server: {c.theirs === null || c.theirs === undefined ? '-' : String(c.theirs)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Reload to discard your changes and start again, or Overwrite to save your values on top of the other user&apos;s.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Cancel
        </Button>
        <Button onClick={onReload} color="primary" disabled={loading}>
          Reload
        </Button>
        <Button onClick={onOverwrite} variant="contained" color="warning" disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Overwrite'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
