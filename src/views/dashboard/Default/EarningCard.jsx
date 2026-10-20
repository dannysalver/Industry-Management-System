import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import { useTheme } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import CardMedia from '@mui/material/CardMedia';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import MainCard from 'ui-component/cards/MainCard';
import SkeletonEarningCard from 'ui-component/cards/Skeleton/EarningCard';

import EarningIcon from 'assets/images/icons/earning.svg';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { get } from 'api';

export default function EarningCard({ isLoading }) {
  const theme = useTheme();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    get('/records/dashboard/summary').then((d) => setTotal(d.totalEarnings)).catch(() => {});
  }, []);

  return (
    <>
      {isLoading ? (
        <SkeletonEarningCard />
      ) : (
        <MainCard
          border={false}
          content={false}
          sx={{
            bgcolor: 'secondary.dark',
            color: '#fff',
            overflow: 'hidden',
            position: 'relative',
            '&:after': {
              content: '""',
              position: 'absolute',
              width: 210,
              height: 210,
              background: theme.vars.palette.secondary[800],
              borderRadius: '50%',
              top: { xs: -85 },
              right: { xs: -95 }
            },
            '&:before': {
              content: '""',
              position: 'absolute',
              width: 210,
              height: 210,
              background: theme.vars.palette.secondary[800],
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
                sx={{ ...theme.typography.largeAvatar, borderRadius: 2, bgcolor: 'secondary.800', mt: 1 }}
              >
                <CardMedia sx={{ width: 30, height: 30 }} component="img" src={EarningIcon} alt="earning" />
              </Avatar>
            </Stack>
            <Stack direction="row" sx={{ alignItems: 'center' }}>
              <Typography sx={{ fontSize: '2.125rem', fontWeight: 500, mr: 1, mt: 1.75, mb: 0.75 }}>
                {total.toLocaleString()}
              </Typography>
              <Avatar sx={{ ...theme.typography.smallAvatar, bgcolor: 'secondary.200', color: 'secondary.dark' }}>
                <ArrowUpwardIcon fontSize="inherit" sx={{ transform: 'rotate3d(1, 1, 1, 45deg)' }} />
              </Avatar>
            </Stack>
            <Typography sx={{ mb: 1.25, fontSize: '1rem', fontWeight: 500, color: 'secondary.200' }}>
              Total Earning
            </Typography>
          </Box>
        </MainCard>
      )}
    </>
  );
}

EarningCard.propTypes = { isLoading: PropTypes.bool };
