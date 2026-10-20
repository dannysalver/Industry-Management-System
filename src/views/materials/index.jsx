import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMaterials } from 'api/materials';
import { get as apiGet, uploadFile } from 'api';
import DataTable from 'ui-component/DataTable';
import FormDialog from 'ui-component/FormDialog';
import ConfirmDialog from 'ui-component/ConfirmDialog';
import ConflictDialog from 'ui-component/ConflictDialog';
import useEditConflict from 'hooks/useEditConflict';
import Avatar from '@mui/material/Avatar';

const columns = [
  {
    id: 'image_url',
    label: 'Image',
    render: (row) => (row.image_url ? <Avatar src={row.image_url} variant="rounded" sx={{ width: 36, height: 36 }} /> : '-')
  },
  { id: 'name', label: 'Name' },
  { id: 'type_name', label: 'Type' },
  { id: 'unit', label: 'Unit' },
  { id: 'price_per_unit', label: 'Price Per Unit' },
  { id: 'stock_threshold', label: 'Threshold' }
];

export default function Materials() {
  const { data, isLoading, create, update, overwrite, remove, mutate } = useMaterials();
  const [materialTypes, setMaterialTypes] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { conflict, resolving, report, cancel, reload, applyOverwrite } = useEditConflict({
    overwrite,
    mutate,
    onResolved: () => setDialogOpen(false)
  });

  useEffect(() => {
    apiGet('/materials/types')
      .then(setMaterialTypes)
      .catch(() => {});
  }, []);

  const formFields = useMemo(
    () => [
      { name: 'name', label: 'Material Name', required: true },
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        required: true,
        options: materialTypes.map((t) => ({ value: t.id, label: t.name }))
      },
      { name: 'price_per_unit', label: 'Price Per 1 Unit', type: 'number', required: true },
      { name: 'stock_threshold', label: 'Low Stock Threshold', type: 'number' },
      { name: 'image_url', label: 'Upload Image', type: 'file' }
    ],
    [materialTypes]
  );

  const dialogInitialValues = useMemo(() => (selected ? { ...selected, type: selected.type } : null), [selected]);

  const handleAdd = useCallback(() => {
    setSelected(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((row) => {
    setSelected(row);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback((row) => {
    setSelected(row);
    setDeleteOpen(true);
  }, []);

  const handleSubmit = useCallback(
    async (values) => {
      setSubmitting(true);
      try {
        let imageUrl = values.image_url;
        if (imageUrl instanceof File) {
          const result = await uploadFile(imageUrl, 'materials');
          imageUrl = result.url;
        }
        const payload = { ...values, image_url: imageUrl, ...(selected ? { version: selected.version } : {}) };
        if (selected) {
          await update(selected.id, payload);
        } else {
          await create(payload);
        }
        setDialogOpen(false);
      } catch (err) {
        if (selected && report(err, { id: selected.id, pending: { ...values, image_url: imageUrl } })) return;
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [selected, update, create, report]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (selected) {
      await remove(selected.id);
      setDeleteOpen(false);
    }
  }, [selected, remove]);

  return (
    <>
      <DataTable
        title="Materials"
        columns={columns}
        rows={data}
        loading={isLoading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        addLabel="Add Material"
      />
      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        title={selected ? 'Edit Material' : 'Add Material'}
        fields={formFields}
        initialValues={dialogInitialValues}
        loading={submitting}
        entityType="materials"
        recordId={selected?.id}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Material"
        message="Are you sure you want to delete this material? This action cannot be undone."
      />
      <ConflictDialog
        open={!!conflict}
        onClose={cancel}
        onReload={reload}
        onOverwrite={applyOverwrite}
        entityLabel="material"
        pending={conflict?.pending}
        current={conflict?.current}
        loading={resolving}
      />
    </>
  );
}
