import { useState, useCallback } from 'react';
import { useClients } from 'api/clients';
import DataTable from 'ui-component/DataTable';
import FormDialog from 'ui-component/FormDialog';
import ConfirmDialog from 'ui-component/ConfirmDialog';
import ConflictDialog from 'ui-component/ConflictDialog';
import useEditConflict from 'hooks/useEditConflict';

const columns = [
  { id: 'name', label: 'Client Name' },
  { id: 'type', label: 'Type' },
  { id: 'contact', label: 'Contact' },
  { id: 'email', label: 'Email' },
  { id: 'balance', label: 'Balance' }
];

const clientTypes = [
  { value: 'Walk-in Customer', label: 'Walk-in Customer' },
  { value: 'Pharmacy', label: 'Pharmacy' },
  { value: 'Distributor', label: 'Distributor' },
  { value: 'Retail Shop', label: 'Retail Shop' },
  { value: 'Hospital/Clinic', label: 'Hospital/Clinic' }
];

const formFields = [
  { name: 'name', label: 'Client Name', required: true },
  { name: 'type', label: 'Client Type', type: 'select', options: clientTypes, required: true },
  { name: 'contact', label: 'Contact' },
  { name: 'email', label: 'Email' },
  { name: 'address', label: 'Address', type: 'textarea' }
];

export default function Clients() {
  const { data, isLoading, create, update, overwrite, remove, mutate } = useClients();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { conflict, resolving, report, cancel, reload, applyOverwrite } = useEditConflict({
    overwrite,
    mutate,
    onResolved: () => setDialogOpen(false)
  });

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
        const payload = { ...values, ...(selected ? { version: selected.version } : {}) };
        if (selected) {
          await update(selected.id, payload);
        } else {
          await create(payload);
        }
        setDialogOpen(false);
      } catch (err) {
        if (selected && report(err, { id: selected.id, pending: values })) return;
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
        title="Clients"
        columns={columns}
        rows={data}
        loading={isLoading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        addLabel="Add Client"
      />
      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        title={selected ? 'Edit Client' : 'Add Client'}
        fields={formFields}
        initialValues={selected}
        loading={submitting}
        entityType="clients"
        recordId={selected?.id}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Client"
        message="Are you sure you want to delete this client?"
      />
      <ConflictDialog
        open={!!conflict}
        onClose={cancel}
        onReload={reload}
        onOverwrite={applyOverwrite}
        entityLabel="client"
        pending={conflict?.pending}
        current={conflict?.current}
        loading={resolving}
      />
    </>
  );
}
