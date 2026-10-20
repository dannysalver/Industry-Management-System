import { useState, useEffect, useCallback } from 'react';
import { get as apiGet, post as apiPost, newIdempotencyKey } from 'api';
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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { IconX } from '@tabler/icons-react';

function StockTab({ itemType, title }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [transactionType, setTransactionType] = useState('in');
  const [submitting, setSubmitting] = useState(false);
  const [idemKey, setIdemKey] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/stock/items/${itemType}`);
      setItems(res);
    } finally {
      setLoading(false);
    }
  }, [itemType]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useAppEvent('app:data', fetchItems);

  const columns = [
    { id: 'name', label: 'Name' },
    ...(itemType === 'material'
      ? [
          { id: 'type_name', label: 'Type' },
          { id: 'unit', label: 'Unit' },
          { id: 'price_per_unit', label: 'Price/Unit' }
        ]
      : [
          { id: 'type_name', label: 'Type' },
          { id: 'price', label: 'Price' },
          { id: 'expiry_days', label: 'Expiry (days)' }
        ]),
    { id: 'stock_quantity', label: 'Stock Qty' }
  ];

  const handleOpen = useCallback(() => {
    setSelectedItem('');
    setQuantity('');
    setTransactionType('in');
    setIdemKey(newIdempotencyKey());
    setDialogOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedItem || !quantity) return;
    setSubmitting(true);
    try {
      const item = items.find((i) => i.id === Number(selectedItem));
      const qty = transactionType === 'out' ? -Math.abs(Number(quantity)) : Number(quantity);
      await apiPost(
        '/stock',
        {
          item_type: itemType,
          item_id: Number(selectedItem),
          item_name: item?.name || '',
          transaction_type: transactionType,
          quantity: qty
        },
        { idempotencyKey: idemKey }
      );
      setDialogOpen(false);
      fetchItems();
    } finally {
      setSubmitting(false);
    }
  }, [selectedItem, quantity, transactionType, items, itemType, idemKey, fetchItems]);

  return (
    <>
      <DataTable title={title} columns={columns} rows={items} loading={loading} onAdd={handleOpen} addLabel="Stock In/Out" />
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Stock Transaction
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
              label="Select Item"
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              required
            >
              <MenuItem value="">Choose an item</MenuItem>
              {items.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name} {item.type_name ? `(${item.type_name})` : ''}
                </MenuItem>
              ))}
            </TextField>
            <ToggleButtonGroup value={transactionType} exclusive fullWidth size="small" onChange={(e, v) => v && setTransactionType(v)}>
              <ToggleButton value="in" sx={{ textTransform: 'none' }}>
                Stock In (+)
              </ToggleButton>
              <ToggleButton value="out" sx={{ textTransform: 'none' }}>
                Stock Out (-)
              </ToggleButton>
            </ToggleButtonGroup>
            <TextField
              fullWidth
              size="small"
              label="Quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color={transactionType === 'out' ? 'error' : 'primary'}
            disabled={submitting || !selectedItem || !quantity}
          >
            {submitting ? <CircularProgress size={20} /> : transactionType === 'out' ? 'Remove Stock' : 'Add Stock'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default function Stock() {
  const [tab, setTab] = useState(0);

  return (
    <>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)}>
          <Tab label="Materials" />
          <Tab label="Products" />
        </Tabs>
      </Box>
      {tab === 0 && <StockTab itemType="material" title="Materials Stock" />}
      {tab === 1 && <StockTab itemType="product" title="Products Stock" />}
    </>
  );
}
