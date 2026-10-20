import { useState, useEffect, useCallback } from 'react';
import { useSuppliers } from 'api/suppliers';
import { get as apiGet } from 'api';
import DataTable from 'ui-component/DataTable';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import { IconX } from '@tabler/icons-react';
import ConfirmDialog from 'ui-component/ConfirmDialog';
import ConflictDialog from 'ui-component/ConflictDialog';
import useEditConflict from 'hooks/useEditConflict';
import { useEditingPresence, useRecordEditors, useCurrentUserId } from 'hooks/usePresence';

const columns = [
  { id: 'name', label: 'Supplier Name' },
  { id: 'contact', label: 'Contact' },
  { id: 'email', label: 'Email' },
  {
    id: 'materials_supplied',
    label: 'Materials Supplied',
    render: (row) => {
      const mats = row.materials_supplied;
      if (!mats || !Array.isArray(mats) || mats.length === 0) return '-';
      return mats
        .map((m) => `${m.material_name}${m.unit ? ` (${m.unit})` : ''}${m.price_per_unit ? ` @ ${m.price_per_unit}` : ''}`)
        .join(', ');
    }
  }
];

export default function Sources() {
  const { data, isLoading, create, update, overwrite, remove, mutate } = useSuppliers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [materials, setMaterials] = useState([]);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState([]);

  const { conflict, resolving, report, cancel, reload, applyOverwrite } = useEditConflict({
    overwrite,
    mutate,
    onResolved: () => setDialogOpen(false)
  });

  useEditingPresence('suppliers', selected?.id, dialogOpen && !!selected);
  const currentUserId = useCurrentUserId();
  const editors = useRecordEditors('suppliers', selected?.id, currentUserId);

  useEffect(() => {
    apiGet('/materials')
      .then(setMaterials)
      .catch(() => {});
  }, []);

  const handleAdd = useCallback(() => {
    setSelected(null);
    setName('');
    setContact('');
    setEmail('');
    setAddress('');
    setSelectedMaterials([]);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((row) => {
    setSelected(row);
    setName(row.name || '');
    setContact(row.contact || '');
    setEmail(row.email || '');
    setAddress(row.address || '');
    const mats = row.materials_supplied;
    setSelectedMaterials(
      Array.isArray(mats)
        ? mats.map((m) => ({ id: m.material_id, name: m.material_name, unit: m.unit || '', price_per_unit: m.price_per_unit || '' }))
        : []
    );
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback((row) => {
    setSelected(row);
    setDeleteOpen(true);
  }, []);

  const buildMaterials = useCallback(
    () =>
      selectedMaterials.map((m) => ({
        material_id: m.id,
        unit: m.unit,
        price_per_unit: m.price_per_unit ? Number(m.price_per_unit) : null
      })),
    [selectedMaterials]
  );

  const handleSubmit = useCallback(async () => {
    if (!name || !contact) return;
    setSubmitting(true);
    try {
      const payload = {
        name,
        contact,
        email,
        address,
        materials: buildMaterials(),
        ...(selected ? { version: selected.version } : {})
      };
      if (selected) {
        await update(selected.id, payload);
      } else {
        await create(payload);
      }
      setDialogOpen(false);
    } catch (err) {
      if (selected && report(err, { id: selected.id, pending: { name, contact, email, address, materials: buildMaterials() } })) return;
      console.error('Failed to save supplier:', err);
    } finally {
      setSubmitting(false);
    }
  }, [name, contact, email, address, buildMaterials, selected, update, create, report]);

  const handleDeleteConfirm = useCallback(async () => {
    if (selected) {
      await remove(selected.id);
      setDeleteOpen(false);
    }
  }, [selected, remove]);

  return (
    <>
      <DataTable
        title="Suppliers"
        columns={columns}
        rows={data}
        loading={isLoading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        addLabel="Add Supplier"
      />
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {selected ? 'Edit Supplier' : 'Add Supplier'}
            {editors.length > 0 && (
              <Chip size="small" color="warning" variant="outlined"
                label={`${editors.map((e) => e.user_name).join(', ')} editing`} />
            )}
          </Box>
          <IconButton onClick={() => setDialogOpen(false)} size="small">
            <IconX size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField fullWidth size="small" label="Supplier Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <TextField fullWidth size="small" label="Contact" value={contact} onChange={(e) => setContact(e.target.value)} required />
            <TextField fullWidth size="small" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Autocomplete
              multiple
              options={materials.filter((m) => !selectedMaterials.some((s) => s.id === m.id))}
              getOptionLabel={(option) => option.name}
              value={[]}
              onChange={(e, newVal) => {
                if (newVal.length > 0) {
                  const item = newVal[newVal.length - 1];
                  setSelectedMaterials((prev) => [
                    ...prev,
                    { id: item.id, name: item.name, unit: item.unit || '', price_per_unit: item.price_per_unit || '' }
                  ]);
                }
              }}
              isOptionEqualToValue={(option, val) => option.id === val.id}
              renderInput={(params) => <TextField {...params} size="small" label="Add Material" placeholder="Select a material" />}
            />
            {selectedMaterials.map((item, idx) => (
              <Box key={item.id} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip
                  label={item.name}
                  onDelete={() => setSelectedMaterials((prev) => prev.filter((_, i) => i !== idx))}
                  size="small"
                  sx={{ minWidth: 120 }}
                />
                <TextField
                  size="small"
                  label="Unit"
                  value={item.unit}
                  slotProps={{ input: { readOnly: true } }}
                  sx={{ width: 80, '& .MuiInputBase-input.Mui-readOnly': { bgcolor: 'action.hover' } }}
                />
                <TextField
                  size="small"
                  label="Price/Unit"
                  type="number"
                  value={item.price_per_unit}
                  slotProps={{ input: { readOnly: true } }}
                  sx={{ width: 110, '& .MuiInputBase-input.Mui-readOnly': { bgcolor: 'action.hover' } }}
                />
              </Box>
            ))}
            <TextField
              fullWidth
              size="small"
              label="Address"
              multiline
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={submitting || !name || !contact}>
            {submitting ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier?"
      />
      <ConflictDialog
        open={!!conflict}
        onClose={cancel}
        onReload={reload}
        onOverwrite={applyOverwrite}
        entityLabel="supplier"
        pending={conflict?.pending}
        current={conflict?.current}
        loading={resolving}
      />
    </>
  );
}
