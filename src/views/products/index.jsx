import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProducts } from 'api/products';
import { get as apiGet, uploadFile } from 'api';
import DataTable from 'ui-component/DataTable';
import FormDialog from 'ui-component/FormDialog';
import ConfirmDialog from 'ui-component/ConfirmDialog';
import ConflictDialog from 'ui-component/ConflictDialog';
import useEditConflict from 'hooks/useEditConflict';
import Avatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { IconPlus, IconTrash } from '@tabler/icons-react';

const columns = [
  {
    id: 'image_url',
    label: 'Image',
    render: (row) => (row.image_url ? <Avatar src={row.image_url} variant="rounded" sx={{ width: 36, height: 36 }} /> : '-')
  },
  { id: 'name', label: 'Name' },
  { id: 'type_name', label: 'Type' },
  { id: 'price', label: 'Price' },
  { id: 'expiry_days', label: 'Expiry (days)' },
  { id: 'production_time', label: 'Time Taken' }
];

export default function Products() {
  const { data, isLoading, create, update, overwrite, remove, mutate } = useProducts();
  const [productTypes, setProductTypes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [productMaterials, setProductMaterials] = useState([]);

  const { conflict, resolving, report, cancel, reload, applyOverwrite } = useEditConflict({
    overwrite,
    mutate,
    onResolved: () => setDialogOpen(false)
  });

  useEffect(() => {
    apiGet('/products/types')
      .then(setProductTypes)
      .catch(() => {});
    apiGet('/materials')
      .then(setMaterials)
      .catch(() => {});
  }, []);

  const formFields = useMemo(
    () => [
      { name: 'name', label: 'Product Name', required: true },
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        required: true,
        options: productTypes.map((t) => ({ value: t.id, label: t.name }))
      },
      { name: 'price', label: 'Price', type: 'number', required: true },
      { name: 'image_url', label: 'Upload Image', type: 'file' },
      { name: 'production_time', label: 'Production Time (hours)', type: 'number' },
      { name: 'expiry_days', label: 'Expiry Days', type: 'number' }
    ],
    [productTypes]
  );

  const dialogInitialValues = useMemo(() => (selected ? { ...selected, type: selected.type } : null), [selected]);

  const handleAdd = useCallback(() => {
    setSelected(null);
    setProductMaterials([]);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback(async (row) => {
    setSelected(row);
    try {
      const res = await apiGet(`/products/${row.id}`);
      setProductMaterials(res.materials || []);
    } catch {
      setProductMaterials([]);
    }
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback((row) => {
    setSelected(row);
    setDeleteOpen(true);
  }, []);

  const addMaterialRow = useCallback(() => {
    setProductMaterials((prev) => [...prev, { material_id: '', quantity: '' }]);
  }, []);

  const removeMaterialRow = useCallback((idx) => {
    setProductMaterials((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateMaterialRow = useCallback((idx, field, value) => {
    setProductMaterials((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (values) => {
      setSubmitting(true);
      try {
        const validMaterials = productMaterials.filter((m) => m.material_id && m.quantity);
        let imageUrl = values.image_url;
        if (imageUrl instanceof File) {
          const result = await uploadFile(imageUrl, 'products');
          imageUrl = result.url;
        }
        const payload = {
          ...values,
          image_url: imageUrl,
          materials: validMaterials,
          ...(selected ? { version: selected.version } : {})
        };
        if (selected) {
          await update(selected.id, payload);
        } else {
          await create(payload);
        }
        setDialogOpen(false);
      } catch (err) {
        if (
          selected &&
          report(err, {
            id: selected.id,
            pending: { ...values, image_url: imageUrl, materials: productMaterials.filter((m) => m.material_id && m.quantity) }
          })
        )
          return;
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [selected, update, create, productMaterials, report]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (selected) {
      await remove(selected.id);
      setDeleteOpen(false);
    }
  }, [selected, remove]);

  const usedMaterialIds = productMaterials.map((m) => m.material_id).filter(Boolean);

  return (
    <>
      <DataTable
        title="Products"
        columns={columns}
        rows={data}
        loading={isLoading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        addLabel="Add Product"
      />
      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        title={selected ? 'Edit Product' : 'Add Product'}
        fields={formFields}
        initialValues={dialogInitialValues}
        loading={submitting}
        entityType="products"
        recordId={selected?.id}
      >
        <Box sx={{ pt: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Materials Used
          </Typography>
          <Stack spacing={1}>
            {productMaterials.map((row, idx) => (
              <Stack key={idx} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TextField
                  select
                  size="small"
                  sx={{ minWidth: 180 }}
                  value={row.material_id}
                  onChange={(e) => updateMaterialRow(idx, 'material_id', Number(e.target.value))}
                >
                  <MenuItem value="">Select material</MenuItem>
                  {materials.map((m) => (
                    <MenuItem key={m.id} value={m.id} disabled={usedMaterialIds.includes(m.id) && m.id !== row.material_id}>
                      {m.name} ({m.unit})
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  type="number"
                  label="Qty"
                  sx={{ width: 100 }}
                  value={row.quantity}
                  onChange={(e) => updateMaterialRow(idx, 'quantity', Number(e.target.value))}
                />
                <IconButton size="small" color="error" onClick={() => removeMaterialRow(idx)}>
                  <IconTrash size={18} />
                </IconButton>
              </Stack>
            ))}
          </Stack>
          <Button type="button" size="small" startIcon={<IconPlus size={16} />} onClick={addMaterialRow} sx={{ mt: 1 }}>
            Add Material
          </Button>
        </Box>
      </FormDialog>
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Product"
        message="Are you sure you want to delete this product?"
      />
      <ConflictDialog
        open={!!conflict}
        onClose={cancel}
        onReload={reload}
        onOverwrite={applyOverwrite}
        entityLabel="product"
        pending={conflict?.pending}
        current={conflict?.current}
        loading={resolving}
      />
    </>
  );
}
