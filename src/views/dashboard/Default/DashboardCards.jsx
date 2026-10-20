import { useState, useEffect } from 'react';

import { useTheme } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import Chart from 'react-apexcharts';

import MainCard from 'ui-component/cards/MainCard';
import LocalMallOutlinedIcon from '@mui/icons-material/LocalMallOutlined';
import { get } from 'api';
import { gridSpacing } from 'store/constant';

const chartOptions = {
  chart: { sparkline: { enabled: true } },
  dataLabels: { enabled: false },
  colors: ['#fff'],
  fill: { type: 'solid', opacity: 1 },
  stroke: { curve: 'smooth', width: 3 },
  yaxis: { min: 0, labels: { show: false } },
  tooltip: {
    fixed: { enabled: false },
    x: { show: true },
    y: { title: { formatter: () => 'Sales' } },
    marker: { show: false }
  }
};

const periods = ['today', 'week', 'month', 'year'];

export default function DashboardCards() {
  const theme = useTheme();
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState(null);

  useEffect(() => {
    get('/records/sales/chart').then(setData).catch(() => {});
  }, []);

  const current = data?.[period] || { total: 0, series: [] };
  const series = current.series?.length
    ? [{ data: current.series.map((s) => s.amount) }]
    : [{ data: [] }];

  return (
    <Grid container spacing={gridSpacing}>
      <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
        <MainCard
          border={false}
          content={false}
          sx={{
            bgcolor: 'primary.dark',
            color: '#fff',
            overflow: 'hidden',
            position: 'relative',
            '&>div': { position: 'relative', zIndex: 5 },
            '&:after': {
              content: '""',
              position: 'absolute',
              width: 210,
              height: 210,
              background: theme.vars.palette.primary[800],
              borderRadius: '50%',
              top: { xs: -85 },
              right: { xs: -95 }
            },
            '&:before': {
              content: '""',
              position: 'absolute',
              width: 210,
              height: 210,
              background: theme.vars.palette.primary[800],
              borderRadius: '50%',
              top: { xs: -125 },
              right: { xs: -15 },
              opacity: 0.5
            }
          }}
        >
          <Box sx={{ p: 2.25 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Avatar
                variant="rounded"
                sx={{ ...theme.typography.largeAvatar, borderRadius: 2, bgcolor: 'primary.800', color: 'common.white', mt: 1 }}
              >
                <LocalMallOutlinedIcon fontSize="inherit" />
              </Avatar>
              <Box>
                {periods.map((p) => (
                  <Button
                    key={p}
                    disableElevation
                    variant={period === p ? 'contained' : 'text'}
                    size="small"
                    sx={{ color: 'inherit', textTransform: 'capitalize', minWidth: 40 }}
                    onClick={() => setPeriod(p)}
                  >
                    {p === 'today' ? '1D' : p === 'week' ? '1W' : p === 'month' ? '1M' : '1Y'}
                  </Button>
                ))}
              </Box>
            </Stack>

            <Grid sx={{ mb: 0.75 }}>
              <Grid container sx={{ alignItems: 'center' }}>
                <Grid size={6}>
                  <Typography sx={{ fontSize: '2.125rem', fontWeight: 500, mr: 1, mt: 1.75, mb: 0.75 }}>
                    {current.total.toLocaleString()}
                  </Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 500, color: 'primary.200' }}>
                    {period === 'today' ? "Today's Sales" : period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'This Year'}
                  </Typography>
                </Grid>
                <Grid
                  size={6}
                  sx={{
                    '.apexcharts-tooltip.apexcharts-theme-light': {
                      color: theme.vars.palette.text.primary,
                      background: theme.vars.palette.background.default
                    }
                  }}
                >
                  {current.series?.length > 0 && (
                    <Chart options={chartOptions} series={series} type="line" height={90} />
                  )}
                </Grid>
              </Grid>
            </Grid>
          </Box>
        </MainCard>
      </Grid>
    </Grid>
  );
}
