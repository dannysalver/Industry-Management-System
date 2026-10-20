import { useTheme } from '@mui/material/styles';
import MainCard from 'ui-component/cards/MainCard';
import SafeChart from 'ui-component/SafeChart';

export default function SalesChart() {
  const theme = useTheme();
  const chartOptions = {
    chart: { id: 'sales-chart', toolbar: { show: false } },
    xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
    colors: [theme.vars.palette.primary.main],
    title: { text: 'Sales Overview', style: { fontSize: '16px' } },
    stroke: { curve: 'smooth', width: 2 },
    grid: { show: true, borderColor: theme.vars.palette.divider },
    yaxis: { title: { text: 'Revenue ($)' } }
  };
  const series = [{ name: 'Sales', data: [30, 40, 35, 50, 49, 60, 70, 91, 125, 100, 85, 110] }];

  return (
    <MainCard title="Sales Chart" contentSX={{ p: 0 }}>
      <SafeChart options={chartOptions} series={series} type="line" height={300} />
    </MainCard>
  );
}
