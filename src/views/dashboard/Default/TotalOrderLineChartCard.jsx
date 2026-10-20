import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import { useTheme } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import MainCard from 'ui-component/cards/MainCard';
import SkeletonTotalOrderCard from 'ui-component/cards/Skeleton/EarningCard';
import { get } from 'api';

import LocalMallOutlinedIcon from '@mui/icons-material/LocalMallOutlined';

export default function TotalOrderLineChartCard({ isLoading }) {
  const theme = useTheme();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    get('/records/expenses/chart').then((d) => {
      const yearTotal = d?.year?.total ?? 0;
      setTotal(yearTotal);
    }).catch(() => {});
  }, []);

  return (
    <>
      {isLoading ? (
        <SkeletonTotalOrderCard />
      ) : (
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
            </Stack>
            <Box sx={{ mb: 0.75 }}>
              <Typography sx={{ fontSize: '2.125rem', fontWeight: 500, mr: 1, mt: 1.75, mb: 0.75 }}>
                {total.toLocaleString()}
              </Typography>
              <Typography sx={{ fontSize: '1rem', fontWeight: 500, color: 'primary.200' }}>
                Total Expenses
              </Typography>
            </Box>
          </Box>
        </MainCard>
      )}
    </>
  );
}

TotalOrderLineChartCard.propTypes = { isLoading: PropTypes.bool };
