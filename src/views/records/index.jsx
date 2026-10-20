import { useState, useCallback, useEffect, useMemo } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import MainCard from 'ui-component/cards/MainCard';
import DataTable from 'ui-component/DataTable';
import { get } from 'api';
import useAuth from 'hooks/useAuth';
import useAppEvent from 'hooks/useAppEvent';
import * as XLSX from 'xlsx';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const tabLabels = {
  sales: 'Sales',
  expenditure: 'Expenditure',
  production: 'Production',
  stock_materials: 'Stock Materials',
  stock_products: 'Stock Products',
  audit: 'Audit Logs'
};

const endpoints = {
  sales: '/records/sales',
  expenditure: '/records/expenses',
  production: '/records/production',
  stock_materials: '/records/stock?item_type=material',
  stock_products: '/records/stock?item_type=product',
  audit: '/records/audit'
};

const columnsByType = {
  sales: [
    { id: 'invoice_no', label: 'Invoice' },
    { id: 'client_name', label: 'Client' },
    { id: 'total_amount', label: 'Total', render: (row) => Number(row.total_amount).toLocaleString() },
    { id: 'created_at', label: 'Date', render: (row) => new Date(row.created_at).toLocaleString() },
    { id: 'created_by_name', label: 'Recorded By' }
  ],
  expenditure: [
    { id: 'type', label: 'Type' },
    { id: 'amount', label: 'Amount', render: (row) => Number(row.amount).toLocaleString() },
    { id: 'date', label: 'Date' },
    { id: 'created_by_name', label: 'Recorded By' }
  ],
  production: [
    { id: 'id', label: 'Batch', render: (row) => `#${row.id}` },
    { id: 'product_name', label: 'Product' },
    { id: 'expected_output', label: 'Quantity' },
    { id: 'status', label: 'Status' },
    { id: 'created_at', label: 'Date', render: (row) => new Date(row.created_at).toLocaleString() }
  ],
  stock_materials: [
    { id: 'item_name', label: 'Item' },
    { id: 'quantity', label: 'Qty', render: (row) => Number(row.quantity).toLocaleString() },
    { id: 'transaction_type', label: 'Transaction' },
    { id: 'created_at', label: 'Date', render: (row) => new Date(row.created_at).toLocaleString() },
    { id: 'created_by_name', label: 'Recorded By' }
  ],
  stock_products: [
    { id: 'item_name', label: 'Item' },
    { id: 'quantity', label: 'Qty', render: (row) => Number(row.quantity).toLocaleString() },
    { id: 'transaction_type', label: 'Transaction' },
    { id: 'created_at', label: 'Date', render: (row) => new Date(row.created_at).toLocaleString() },
    { id: 'created_by_name', label: 'Recorded By' }
  ],
  audit: [
    { id: 'user_name', label: 'User' },
    { id: 'action', label: 'Action' },
    { id: 'details', label: 'Details' },
    { id: 'created_at', label: 'Timestamp', render: (row) => new Date(row.created_at).toLocaleString() }
  ]
};

const roleTabs = {
  Admin: ['sales', 'expenditure', 'production', 'stock_materials', 'stock_products', 'audit'],
  'Store Keeper': ['stock_materials', 'stock_products', 'audit'],
  'Production Manager': ['stock_materials', 'stock_products', 'production', 'audit'],
  'Sales Officer': ['sales', 'expenditure', 'audit'],
  Accountant: ['sales', 'expenditure', 'audit']
};

export default function Records() {
  const { role } = useAuth();
  const tabs = useMemo(() => roleTabs[role] || ['audit'], [role]);
  const [tab, setTab] = useState(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTab(0);
  }, [tabs]);

  const fetchRecords = useCallback(async (type) => {
    const ep = endpoints[type] || '/records';
    setLoading(true);
    try {
      const result = await get(ep);
      console.log(`[Records] ${type} data:`, result);
      setData(result || []);
    } catch (err) {
      console.error(`[Records] ${type} fetch error:`, err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tabs[tab]) fetchRecords(tabs[tab]);
  }, [tab, tabs, fetchRecords]);

  useAppEvent(
    'app:data',
    useCallback(() => {
      if (tabs[tab]) fetchRecords(tabs[tab]);
    }, [tab, tabs, fetchRecords])
  );

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const handleExport = () => {
    const currentTab = tabs[tab];
    const columns = columnsByType[currentTab];
    const label = tabLabels[currentTab] || currentTab;

    const ws = XLSX.utils.json_to_sheet(
      data.map((row) => {
        const obj = {};
        columns.forEach((c) => {
          obj[c.label] = c.render ? c.render(row) : (row[c.id] ?? '');
        });
        return obj;
      })
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, label);
    XLSX.writeFile(wb, `${label.replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <MainCard title="Records & Reports">
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} justifyContent="flex-end">
        <Button size="small" variant="outlined" onClick={handleExport}>
          Export Excel
        </Button>
      </Stack>
      <Tabs value={tab} onChange={handleTabChange} variant="scrollable">
        {tabs.map((type) => (
          <Tab key={type} label={tabLabels[type] || type} />
        ))}
      </Tabs>
      {tabs.map((type, index) => (
        <TabPanel key={type} value={tab} index={index}>
          <DataTable title="" columns={columnsByType[type]} rows={data} loading={loading} />
        </TabPanel>
      ))}
    </MainCard>
  );
}
