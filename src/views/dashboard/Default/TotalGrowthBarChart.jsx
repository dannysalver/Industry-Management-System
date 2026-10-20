import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';

import { useTheme } from '@mui/material/styles';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import Chart from 'react-apexcharts';

import useConfig from 'hooks/useConfig';
import SkeletonTotalGrowthBarChart from 'ui-component/cards/Skeleton/TotalGrowthBarChart';
import MainCard from 'ui-component/cards/MainCard';
import { gridSpacing } from 'store/constant';
import barChartOptions from './chart-data/total-growth-bar-chart';
import { get } from 'api';

const status = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' }
];

function getSeries(period, sales, expenses) {
  if (period === 'today') {
    return [
      { name: 'Sales', data: [sales?.today?.total ?? 0] },
      { name: 'Expenses', data: [expenses?.today?.total ?? 0] }
    ];
  }
  if (period === 'week') {
    const sSeries = sales?.week?.series?.map((s) => s.amount) ?? [];
    const eSeries = expenses?.week?.series?.map((s) => s.amount) ?? [];
    return [
      { name: 'Sales', data: sSeries },
      { name: 'Expenses', data: eSeries }
    ];
  }
  if (period === 'month') {
    const sSeries = sales?.month?.series?.map((s) => s.amount) ?? [];
    const eSeries = expenses?.month?.series?.map((s) => s.amount) ?? [];
    return [
      { name: 'Sales', data: sSeries },
      { name: 'Expenses', data: eSeries }
    ];
  }
  const sSeries = sales?.year?.series?.map((s) => s.amount) ?? [];
  const eSeries = expenses?.year?.series?.map((s) => s.amount) ?? [];
  return [
    { name: 'Sales', data: sSeries },
    { name: 'Expenses', data: eSeries }
  ];
}

function getCategories(period, sales) {
  if (period === 'today') return ['Today'];
  if (period === 'week') return sales?.week?.series?.map((s) => s.day) ?? [];
  if (period === 'month') return sales?.month?.series?.map((s) => s.week) ?? [];
  return sales?.year?.series?.map((s) => s.month) ?? [];
}

function getTotal(period, sales, expenses) {
  const s = period === 'today'
    ? (sales?.today?.total ?? 0)
    : period === 'week'
    ? (sales?.week?.total ?? 0)
    : period === 'month'
    ? (sales?.month?.total ?? 0)
    : (sales?.year?.total ?? 0);
  const e = period === 'today'
    ? (expenses?.today?.total ?? 0)
    : period === 'week'
    ? (expenses?.week?.total ?? 0)
    : period === 'month'
    ? (expenses?.month?.total ?? 0)
    : (expenses?.year?.total ?? 0);
  return { sales: s, expenses: e, net: s - e };
}

export default function TotalGrowthBarChart({ isLoading }) {
  const theme = useTheme();
  const { state: { fontFamily } } = useConfig();

  const [value, setValue] = useState('today');
  const [chartOptionsState, setChartOptionsState] = useState(barChartOptions);
  const [salesData, setSalesData] = useState(null);
  const [expensesData, setExpensesData] = useState(null);

  useEffect(() => {
    get('/records/sales/chart').then(setSalesData).catch(() => {});
    get('/records/expenses/chart').then(setExpensesData).catch(() => {});
  }, []);

  const textPrimary = theme.vars.palette.text.primary;
  const divider = theme.vars.palette.divider;
  const grey500 = theme.vars.palette.grey[500];
  const blue = theme.vars.palette.primary.main;
  const yellow = theme.vars.palette.warning.main;

  const series = useMemo(() => getSeries(value, salesData, expensesData), [value, salesData, expensesData]);
  const categories = useMemo(() => getCategories(value, salesData), [value, salesData]);
  const total = useMemo(() => getTotal(value, salesData, expensesData), [value, salesData, expensesData]);

  useEffect(() => {
    setChartOptionsState({
      ...barChartOptions,
      chart: { ...barChartOptions.chart, fontFamily: fontFamily },
      colors: [blue, yellow],
      xaxis: { ...barChartOptions.xaxis, categories, labels: { style: { colors: textPrimary } } },
      yaxis: { ...barChartOptions.yaxis, labels: { style: { colors: textPrimary } } },
      grid: { borderColor: divider },
      tooltip: { theme: 'light' },
      legend: { ...(barChartOptions.legend ?? {}), labels: { ...(barChartOptions.legend?.labels ?? {}), colors: grey500 } }
    });
  }, [fontFamily, blue, yellow, textPrimary, grey500, divider, categories]);

  return (
    <>
      {isLoading ? (
        <SkeletonTotalGrowthBarChart />
      ) : (
        <MainCard>
          <Stack sx={{ gap: gridSpacing }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Stack sx={{ gap: 1 }}>
                <Typography variant="subtitle2">Performance Overview</Typography>
                <Stack direction="row" sx={{ gap: 2, alignItems: 'baseline' }}>
                  <Typography variant="h3" sx={{ color: 'primary.main' }}>{total.sales.toLocaleString()}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>Sales</Typography>
                  <Typography variant="h3" sx={{ color: 'warning.main' }}>{total.expenses.toLocaleString()}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>Expenses</Typography>
                  <Typography variant="h4" sx={{ color: total.net >= 0 ? 'success.main' : 'error.main' }}>
                    Net: {total.net.toLocaleString()}
                  </Typography>
                </Stack>
              </Stack>
              <TextField id="standard-select-currency" select value={value} onChange={(e) => setValue(e.target.value)}>
                {status.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Box
              sx={{
                ...theme.applyStyles('light', {
                  '& .apexcharts-series:nth-of-type(4) path:hover': {
                    filter: `brightness(0.95)`,
                    transition: 'all 0.3s ease'
                  }
                })
              }}
            >
              <Chart
                options={chartOptionsState}
                series={(salesData && expensesData) ? series : []}
                type="bar"
                height={480}
              />
            </Box>
          </Stack>
        </MainCard>
      )}
    </>
  );
}

TotalGrowthBarChart.propTypes = { isLoading: PropTypes.bool };
