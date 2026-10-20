import { useTheme } from '@mui/material/styles';
import MainCard from 'ui-component/cards/MainCard';
import SafeChart from 'ui-component/SafeChart';

export default function StockChart() {
  const theme = useTheme();
  const chartOptions = {
    chart: { id: 'stock-chart' },
    labels: ['Products', 'Raw Materials', 'Other'],
    colors: [theme.vars.palette.success.main, theme.vars.palette.warning.main, theme.vars.palette.grey[400]],
    title: { text: 'Stock Distribution', style: { fontSize: '16px' } },
    legend: { position: 'bottom' },
    responsive: [{ breakpoint: 480, options: { chart: { width: 200 }, legend: { position: 'bottom' } } }]
  };
  const series = [45, 35, 20];

  return (
    <MainCard title="Stock Chart" contentSX={{ p: 0 }}>
      <SafeChart options={chartOptions} series={series} type="donut" height={300} />
    </MainCard>
  );
}
