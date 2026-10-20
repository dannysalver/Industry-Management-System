import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import { IconX, IconUpload, IconPencil } from '@tabler/icons-react';
import useAuth from 'hooks/useAuth';
import { useEditingPresence, useRecordEditors } from 'hooks/usePresence';

function FormField({ field, value, onChange, error }) {
  if (field.type === 'file') {
    const isImage = field.accept !== 'application/pdf';
    return (
      <Box>
        <input
          accept={field.accept || 'image/*'}
          style={{ display: 'none' }}
          id={`file-${field.name}`}
          type="file"
          onChange={(e) => onChange(field.name, e.target.files[0])}
        />
        <label htmlFor={`file-${field.name}`}>
          <Button variant="outlined" component="span" startIcon={<IconUpload size={18} />} fullWidth>
            {field.label}
          </Button>
        </label>
        {value && value instanceof File && (
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            {isImage && <Avatar src={URL.createObjectURL(value)} variant="rounded" sx={{ width: 48, height: 48 }} />}
            <Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{value.name}</Box>
          </Box>
        )}
        {value && typeof value === 'string' && value.startsWith('/storage/') && (
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            {isImage && <Avatar src={value} variant="rounded" sx={{ width: 48, height: 48 }} />}
            <Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>Current image</Box>
          </Box>
        )}
        {error && <Box sx={{ color: 'error.main', fontSize: '0.75rem', mt: 0.5 }}>{error}</Box>}
      </Box>
    );
  }

  if (field.type === 'select') {
    return (
      <TextField
        select
        fullWidth
        size="small"
        label={field.label}
        value={value || ''}
        onChange={(e) => onChange(field.name, e.target.value)}
        error={!!error}
        helperText={error}
        required={field.required}
      >
        {field.options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  if (field.type === 'number') {
    return (
      <TextField
        fullWidth
        size="small"
        label={field.label}
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(field.name, e.target.value === '' ? '' : Number(e.target.value))}
        error={!!error}
        helperText={error}
        required={field.required}
      />
    );
  }

  if (field.type === 'textarea') {
    return (
      <TextField
        fullWidth
        size="small"
        label={field.label}
        multiline
        rows={3}
        value={value || ''}
        onChange={(e) => onChange(field.name, e.target.value)}
        error={!!error}
        helperText={error}
        required={field.required}
      />
    );
  }

  return (
    <TextField
      fullWidth
      size="small"
      label={field.label}
      type={field.type || 'text'}
      value={value || ''}
      onChange={(e) => onChange(field.name, e.target.value)}
      error={!!error}
      helperText={error}
      required={field.required}
    />
  );
}

export default function FormDialog({ open, onClose, onSubmit, title, fields, initialValues, loading, children, entityType, recordId }) {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const { user } = useAuth();

  useEditingPresence(entityType, recordId, open);
  const editors = useRecordEditors(entityType, recordId, user?.id);

  useEffect(() => {
    if (open) {
      const defaults = {};
      fields.forEach((f) => {
        if (f.type === 'file') {
          defaults[f.name] = initialValues?.[f.name] || null;
        } else {
          defaults[f.name] = initialValues?.[f.name] ?? '';
        }
      });
      setValues(defaults);
      setErrors({});
    }
  }, [open, fields, initialValues]);

  const handleChange = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    fields.forEach((f) => {
      if (f.required && (values[f.name] === '' || values[f.name] === undefined || values[f.name] === null)) {
        newErrors[f.name] = `${f.label} is required`;
      }
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    await onSubmit(values);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {title}
            {editors.length > 0 && (
              <Tooltip title={`Also editing: ${editors.map((e) => e.user_name).join(', ')}`}>
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  icon={<IconPencil size={14} />}
                  label={editors.map((e) => e.user_name).join(', ')}
                />
              </Tooltip>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <IconX size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {fields.map((field) => (
              <FormField key={field.name} field={field} value={values[field.name]} onChange={handleChange} error={errors[field.name]} />
            ))}
            {children}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
