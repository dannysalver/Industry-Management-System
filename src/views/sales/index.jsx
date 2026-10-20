import { useState, useEffect, useCallback } from 'react';
import { get as apiGet, post as apiPost, del as apiDel, newIdempotencyKey } from 'api';
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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { IconX, IconPlus } from '@tabler/icons-react';
import ConfirmDialog from 'ui-component/ConfirmDialog';

const columns = [
  { id: 'invoice_no', label: 'Invoice No' },
  { id: 'client_name', label: 'Client' },
  { id: 'total_amount', label: 'Total' },
  { id: 'payment_method', label: 'Payment' },
  { id: 'created_at', label: 'Date', render: (row) => new Date(row.created_at).toLocaleString() }
];

export default function Sales() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  const [newProductId, setNewProductId] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [productStock, setProductStock] = useState({});
  const [idemKey, setIdemKey] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sales, c, p] = await Promise.all([apiGet('/sales'), apiGet('/clients'), apiGet('/products')]);
      setData(sales);
      setClients(c);
      setProducts(p);
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

  const handleAdd = useCallback(async () => {
    setSelected(null);
    setClientId('');
    setItems([]);
    setNewProductId('');
    setNewQuantity('');
    setPaymentMethod('Cash');
    setIdemKey(newIdempotencyKey());
    try {
      const stock = await apiGet('/stock?item_type=product');
      const map = {};
      for (const t of stock) {
        map[t.item_id] = (map[t.item_id] || 0) + Number(t.quantity);
      }
      setProductStock(map);
    } catch {
      setProductStock({});
    }
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback((row) => {
    setSelected(row);
    setDeleteOpen(true);
  }, []);

  const handleAddItem = useCallback(() => {
    if (!newProductId || !newQuantity) return;
    const product = products.find((p) => p.id === Number(newProductId));
    if (!product) return;
    const qty = Number(newQuantity);
    const available = productStock[newProductId] || 0;
    if (qty > available) {
      alert(`Insufficient stock for "${product.name}". Available: ${available}`);
      return;
    }
    setItems((prev) => [
      ...prev,
      { product_id: Number(newProductId), quantity: qty, unit_price: product.price, product_name: product.name }
    ]);
    setNewProductId('');
    setNewQuantity('');
  }, [newProductId, newQuantity, products, productStock]);

  const handleRemoveItem = useCallback((index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const handleSubmit = useCallback(async () => {
    if (!clientId || !items.length || !paymentMethod) return;
    setSubmitting(true);
    try {
      await apiPost(
        '/sales',
        {
          client_id: Number(clientId),
          items: items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
          payment_method: paymentMethod
        },
        { idempotencyKey: idemKey }
      );
      setDialogOpen(false);
      fetchData();
    } finally {
      setSubmitting(false);
    }
  }, [clientId, items, paymentMethod, idemKey, fetchData]);

  const handleDeleteConfirm = useCallback(async () => {
    if (selected) {
      await apiDel(`/sales/${selected.id}`);
      setDeleteOpen(false);
      fetchData();
    }
  }, [selected, fetchData]);

  return (
    <>
      <DataTable
        title="Sales"
        columns={columns}
        rows={data}
        loading={loading}
        onAdd={handleAdd}
        onDelete={handleDelete}
        addLabel="New Sale"
      />
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          New Sale
          <IconButton onClick={() => setDialogOpen(false)} size="small">
            <IconX size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField select fullWidth size="small" label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
              <MenuItem value="">Select client</MenuItem>
              {clients.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>

            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Items
            </Typography>

            {items.length > 0 && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Subtotal</TableCell>
                      <TableCell width={40} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{item.unit_price.toLocaleString()}</TableCell>
                        <TableCell align="right">{(item.quantity * item.unit_price).toLocaleString()}</TableCell>
                        <TableCell>
                          <IconButton size="small" color="error" onClick={() => handleRemoveItem(idx)}>
                            <IconX size={16} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                select
                size="small"
                label="Product"
                value={newProductId}
                onChange={(e) => setNewProductId(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">Select</MenuItem>
                {products
                  .filter((p) => !items.some((i) => i.product_id === p.id))
                  .map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name} {productStock[p.id] !== undefined ? `(Stock: ${productStock[p.id]})` : ''}
                    </MenuItem>
                  ))}
              </TextField>
              <TextField
                size="small"
                label="Qty"
                type="number"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                sx={{ width: 80 }}
                error={newProductId && newQuantity && Number(newQuantity) > (productStock[newProductId] || 0)}
                helperText={
                  newProductId && newQuantity && Number(newQuantity) > (productStock[newProductId] || 0) ? 'Exceeds stock' : undefined
                }
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleAddItem}
                disabled={!newProductId || !newQuantity || Number(newQuantity) > (productStock[newProductId] || 0)}
                startIcon={<IconPlus size={16} />}
                sx={{ mt: 0.5 }}
              >
                Add
              </Button>
            </Box>

            <Box sx={{ p: 1.5, bgcolor: 'primary.light', borderRadius: 1 }}>
              <Typography variant="subtitle1" sx={{ color: 'primary.contrastText' }}>
                Total: <strong>{total.toLocaleString()}</strong>
              </Typography>
            </Box>
            <ToggleButtonGroup value={paymentMethod} exclusive fullWidth size="small" onChange={(e, v) => v && setPaymentMethod(v)}>
              <ToggleButton value="Cash" sx={{ textTransform: 'none' }}>
                Cash
              </ToggleButton>
              <ToggleButton value="Online" sx={{ textTransform: 'none' }}>
                Online
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={submitting || !clientId || items.length === 0}>
            {submitting ? <CircularProgress size={20} /> : 'Create Sale'}
          </Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Sale"
        message="Are you sure you want to delete this sale?"
      />
    </>
  );
}
