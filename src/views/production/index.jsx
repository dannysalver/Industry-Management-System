import { useState, useEffect, useCallback, useMemo } from 'react';
import { get as apiGet, post as apiPost, put as apiPut, newIdempotencyKey } from 'api';
import useAppEvent from 'hooks/useAppEvent';
import DataTable from 'ui-component/DataTable';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { IconX } from '@tabler/icons-react';
import ConfirmDialog from 'ui-component/ConfirmDialog';

const statusColors = {
  'In Progress': 'info',
  'Pending Completion': 'warning',
  Completed: 'success',
  Cancelled: 'error'
};

const columns = [
  { id: 'product_name', label: 'Product' },
  { id: 'expected_output', label: 'Expected Output' },
  {
    id: 'status',
    label: 'Status',
    render: (row) => <Chip label={row.status} color={statusColors[row.status] || 'default'} size="small" />
  },
  {
    id: 'start_time',
    label: 'Started',
    render: (row) => (row.start_time ? new Date(row.start_time).toLocaleString() : '-')
  },
  {
    id: 'expected_completion_date',
    label: 'Expected Completion',
    render: (row) => (row.expected_completion_date ? new Date(row.expected_completion_date).toLocaleString() : '-')
  },
  { id: 'started_by_name', label: 'Staff' },
  { id: 'notes', label: 'Notes' }
];

export default function Production() {
  const [data, setData] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [materialRows, setMaterialRows] = useState([]);
  const [startTime, setStartTime] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedOutput, setExpectedOutput] = useState(0);
  const [users, setUsers] = useState([]);
  const [responsibleStaff, setResponsibleStaff] = useState('');

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusAction, setStatusAction] = useState(null);
  const [idemKey, setIdemKey] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodData, prodList, usersData] = await Promise.all([apiGet('/productions'), apiGet('/products'), apiGet('/auth/users')]);
      setData(prodData);
      setProducts(prodList);
      setUsers(usersData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useAppEvent(
    'app:data',
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleProductChange = useCallback(async (productId) => {
    setSelectedProductId(productId);
    setMaterialRows([]);
    setExpectedOutput(0);
    if (!productId) return;
    try {
      const res = await apiGet(`/products/${productId}`);
      const mats = res.materials || [];
      const stockPromises = mats.map((m) =>
        apiGet('/stock?item_type=material').then((stock) => {
          const total = stock.filter((t) => t.item_id === m.material_id).reduce((sum, t) => sum + Number(t.quantity), 0);
          return { [m.material_id]: total };
        })
      );
      const stockResults = await Promise.all(stockPromises);
      const stockData = Object.assign({}, ...stockResults);
      setMaterialRows(
        mats.map((m) => ({
          material_id: m.material_id,
          material_name: m.material_name,
          required_qty: m.quantity,
          unit: m.unit,
          used_qty: '',
          available: stockData[m.material_id] || 0
        }))
      );

      setStartTime(getEatTime());
    } catch {
      setMaterialRows([]);
    }
  }, []);

  const updateUsedQty = useCallback((idx, value) => {
    setMaterialRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], used_qty: Number(value) };
      return next;
    });
  }, []);

  useEffect(() => {
    let minOutput = Infinity;
    for (const row of materialRows) {
      if (row.used_qty && row.required_qty > 0) {
        const possible = row.used_qty / row.required_qty;
        if (possible < minOutput) minOutput = possible;
      }
    }
    setExpectedOutput(minOutput === Infinity ? 0 : Math.floor(minOutput));
  }, [materialRows]);

  function getEatTime() {
    const now = new Date();
    const eat = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    return eat.toISOString().slice(0, 16);
  }

  const handleAdd = useCallback(() => {
    setSelected(null);
    setSelectedProductId('');
    setMaterialRows([]);
    setStartTime(getEatTime());
    setNotes('');
    setExpectedOutput(0);
    setResponsibleStaff('');
    setIdemKey(newIdempotencyKey());
    setDialogOpen(true);
  }, []);

  const handleStatusAction = useCallback((row, newStatus) => {
    setSelected(row);
    setStatusAction(newStatus);
    setStatusDialogOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const validMaterials = materialRows.filter((m) => m.material_id && m.used_qty);
      const exceedsStock = validMaterials.some((m) => Number(m.used_qty) > (m.available || 0));
      if (exceedsStock) {
        alert('Some materials exceed available stock.');
        return;
      }
      await apiPost(
        '/productions',
        {
          product_id: Number(selectedProductId),
          materials: validMaterials.map((m) => ({ material_id: m.material_id, used_qty: m.used_qty })),
          start_time: startTime ? new Date(startTime).toISOString() : null,
          started_by: responsibleStaff ? Number(responsibleStaff) : null,
          notes
        },
        { idempotencyKey: idemKey }
      );
      setDialogOpen(false);
      fetchData();
    } finally {
      setSubmitting(false);
    }
  }, [selectedProductId, materialRows, startTime, responsibleStaff, notes, idemKey, fetchData]);

  const handleStatusConfirm = useCallback(async () => {
    if (selected && statusAction) {
      await apiPut(`/productions/${selected.id}`, { status: statusAction });
      setStatusDialogOpen(false);
      fetchData();
    }
  }, [selected, statusAction, fetchData]);

  const addActionColumn = useMemo(
    () => ({
      id: 'actions',
      label: 'Actions',
      render: (row) => {
        if (row.status === 'In Progress' || row.status === 'Pending Completion') {
          const actions = [];
          if (row.status === 'In Progress') {
            actions.push(
              <Button key="cancel" size="small" color="error" onClick={() => handleStatusAction(row, 'Cancelled')} sx={{ mr: 0.5 }}>
                Cancel
              </Button>
            );
          }
          actions.push(
            <Button key="complete" size="small" variant="contained" onClick={() => handleStatusAction(row, 'Completed')}>
              Complete
            </Button>
          );
          return <Stack direction="row">{actions}</Stack>;
        }
        return <Chip label={row.status} color={statusColors[row.status] || 'default'} size="small" />;
      }
    }),
    [handleStatusAction]
  );

  const allColumns = useMemo(() => [...columns, addActionColumn], [addActionColumn]);

  return (
    <>
      <DataTable title="Production" columns={allColumns} rows={data} loading={loading} onAdd={handleAdd} addLabel="Start Production" />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Start Production
            <IconButton onClick={() => setDialogOpen(false)} size="small">
              <IconX size={18} />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Select Product"
                value={selectedProductId}
                onChange={(e) => handleProductChange(e.target.value)}
                required
              >
                <MenuItem value="">Choose a product</MenuItem>
                {products.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>

              {materialRows.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Raw Materials Used
                  </Typography>
                  <Stack spacing={1}>
                    {materialRows.map((row, idx) => {
                      const exceedsStock = row.used_qty && Number(row.used_qty) > row.available;
                      return (
                        <Stack key={idx} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <TextField
                            size="small"
                            label="Material"
                            value={row.material_name}
                            sx={{ minWidth: 160 }}
                            slotProps={{ input: { readOnly: true } }}
                          />
                          <TextField
                            size="small"
                            label="Req/Unit"
                            value={row.required_qty}
                            sx={{ width: 90 }}
                            slotProps={{ input: { readOnly: true } }}
                          />
                          <TextField
                            size="small"
                            type="number"
                            label={`Used (${row.unit})`}
                            sx={{ width: 110 }}
                            value={row.used_qty}
                            onChange={(e) => updateUsedQty(idx, e.target.value)}
                            error={exceedsStock}
                            helperText={exceedsStock ? `Stock: ${row.available}` : undefined}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 50 }}>
                            Stock: {row.available}
                          </Typography>
                        </Stack>
                      );
                    })}
                  </Stack>
                </Box>
              )}

              <Box sx={{ p: 1.5, bgcolor: 'primary.light', borderRadius: 1 }}>
                <Typography variant="subtitle1" sx={{ color: 'primary.contrastText' }}>
                  Expected Output: <strong>{expectedOutput}</strong> units
                </Typography>
              </Box>

              <TextField
                fullWidth
                size="small"
                label="Start Time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                required
              />
              <TextField
                select
                fullWidth
                size="small"
                label="Responsible Staff"
                value={responsibleStaff}
                onChange={(e) => setResponsibleStaff(e.target.value)}
                required
              >
                <MenuItem value="">Select staff</MenuItem>
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField fullWidth size="small" label="Notes" multiline rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                submitting || materialRows.length === 0 || materialRows.some((m) => m.used_qty && Number(m.used_qty) > (m.available || 0))
              }
            >
              {submitting ? <CircularProgress size={20} /> : 'Start Production'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmDialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
        onConfirm={handleStatusConfirm}
        title={statusAction === 'Cancelled' ? 'Cancel Production' : 'Complete Production'}
        message={`Are you sure you want to mark production #${selected?.id} as "${statusAction}"?`}
        confirmLabel="Yes"
        cancelLabel="No"
        confirmColor={statusAction === 'Completed' ? 'primary' : 'error'}
      />
    </>
  );
}
