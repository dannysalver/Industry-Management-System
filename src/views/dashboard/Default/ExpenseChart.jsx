import { useTheme } from '@mui/material/styles';
import MainCard from 'ui-component/cards/MainCard';
import SafeChart from 'ui-component/SafeChart';

export default function ExpenseChart() {
  const theme = useTheme();
  const chartOptions = {
    chart: { id: 'expense-chart', toolbar: { show: false } },
    xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
    colors: [theme.vars.palette.error.main],
    title: { text: 'Expenditure', style: { fontSize: '16px' } },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
    grid: { show: true, borderColor: theme.vars.palette.divider },
    yaxis: { title: { text: 'Amount ($)' } },
    dataLabels: { enabled: false }
  };
  const series = [{ name: 'Expenses', data: [20, 25, 30, 28, 35, 40, 38, 42, 45, 50, 48, 55] }];

  return (
    <MainCard title="Expenditure Chart" contentSX={{ p: 0 }}>
      <SafeChart options={chartOptions} series={series} type="bar" height={300} />
    </MainCard>
  );
}
