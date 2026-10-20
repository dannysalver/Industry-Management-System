import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, cancelLabel, confirmColor }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title || 'Confirm'}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message || 'Are you sure?'}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {cancelLabel || 'Cancel'}
        </Button>
        <Button onClick={onConfirm} color={confirmColor || 'error'} variant="contained">
          {confirmLabel || 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
