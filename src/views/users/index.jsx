import { useState, useEffect, useCallback, useMemo } from 'react';
import { get as apiGet, post as apiPost, put as apiPut, del as apiDel } from 'api';
import DataTable from 'ui-component/DataTable';
import FormDialog from 'ui-component/FormDialog';
import ConfirmDialog from 'ui-component/ConfirmDialog';
import ConflictDialog from 'ui-component/ConflictDialog';
import useEditConflict from 'hooks/useEditConflict';

const columns = [
  { id: 'name', label: 'Name' },
  { id: 'email', label: 'Email' },
  { id: 'role', label: 'Role' }
];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/auth/users');
      setUsers(data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const { conflict, resolving, report, cancel, reload, applyOverwrite } = useEditConflict({
    overwrite: async (id, body, version) => apiPut(`/auth/users/${id}`, { ...body, version }),
    mutate: fetchUsers,
    onResolved: () => setDialogOpen(false)
  });

  useEffect(() => {
    apiGet('/roles')
      .then(setRoles)
      .catch(() => {});
  }, []);

  const formFields = useMemo(
    () => [
      { name: 'name', label: 'Full Name', required: true },
      { name: 'email', label: 'Email', required: true },
      { name: 'password', label: selected ? 'Password (leave blank to keep)' : 'Password', type: 'password', required: !selected },
      {
        name: 'role_id',
        label: 'Role',
        type: 'select',
        required: true,
        options: roles.map((r) => ({ value: r.id, label: r.role }))
      }
    ],
    [roles, selected]
  );

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
        if (selected) {
          await apiPut(`/auth/users/${selected.id}`, { ...values, version: selected.version });
        } else {
          await apiPost('/auth/users', values);
        }
        setDialogOpen(false);
        fetchUsers();
      } catch (err) {
        if (selected && report(err, { id: selected.id, pending: values })) return;
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [selected, fetchUsers, report]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!selected) return;
    try {
      await apiDel(`/auth/users/${selected.id}`);
      setDeleteOpen(false);
      fetchUsers();
    } catch (err) {
      console.error('Delete user error:', err);
    }
  }, [selected, fetchUsers]);

  const dialogInitialValues = useMemo(
    () => (selected ? { name: selected.name, email: selected.email, password: '', role_id: selected.role_id } : null),
    [selected]
  );

  return (
    <>
      <DataTable
        title="Users"
        columns={columns}
        rows={users}
        loading={loading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        addLabel="Add User"
      />
      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        title={selected ? 'Edit User' : 'Add User'}
        fields={formFields}
        initialValues={dialogInitialValues}
        loading={submitting}
        entityType="users"
        recordId={selected?.id}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete User"
        message="Are you sure you want to delete this user?"
      />
      <ConflictDialog
        open={!!conflict}
        onClose={cancel}
        onReload={reload}
        onOverwrite={applyOverwrite}
        entityLabel="user"
        pending={conflict?.pending}
        current={conflict?.current}
        loading={resolving}
      />
    </>
  );
}
