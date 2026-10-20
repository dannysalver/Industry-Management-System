import { useState, useCallback } from 'react';
import { useExpenses } from 'api/expenses';
import DataTable from 'ui-component/DataTable';
import FormDialog from 'ui-component/FormDialog';
import ConfirmDialog from 'ui-component/ConfirmDialog';
import ConflictDialog from 'ui-component/ConflictDialog';
import useEditConflict from 'hooks/useEditConflict';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const columns = [
  { id: 'type', label: 'Type' },
  { id: 'amount', label: 'Amount' },
  { id: 'date', label: 'Date' },
  { id: 'created_by_name', label: 'Recorded By' }
];

const expenseTypes = [
  { value: 'Raw Materials', label: 'Raw Materials' },
  { value: 'Utilities', label: 'Utilities' },
  { value: 'Salaries', label: 'Salaries' },
  { value: 'Transport', label: 'Transport' },
  { value: 'Maintenance', label: 'Maintenance' },
  { value: 'Other', label: 'Other' }
];

const formFields = [
  { name: 'type', label: 'Expense Type', type: 'select', options: expenseTypes, required: true },
  { name: 'amount', label: 'Amount', type: 'number', required: true },
  { name: 'date', label: 'Date', type: 'date' }
];

export default function Expenses() {
  const { data, isLoading, create, update, overwrite, remove, mutate } = useExpenses();
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
        title="Expenses"
        columns={columns}
        rows={data}
        loading={isLoading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        addLabel="Add Expense"
      />
      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        title={selected ? 'Edit Expense' : 'Add Expense'}
        fields={formFields}
        initialValues={selected || { date: todayStr() }}
        loading={submitting}
        entityType="expenses"
        recordId={selected?.id}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Expense"
        message="Are you sure you want to delete this expense?"
      />
      <ConflictDialog
        open={!!conflict}
        onClose={cancel}
        onReload={reload}
        onOverwrite={applyOverwrite}
        entityLabel="expense"
        pending={conflict?.pending}
        current={conflict?.current}
        loading={resolving}
      />
    </>
  );
}
