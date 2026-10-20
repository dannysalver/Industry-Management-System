import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import Avatar from '@mui/material/Avatar';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import MainCard from 'ui-component/cards/MainCard';
import SkeletonPopularCard from 'ui-component/cards/Skeleton/PopularCard';
import { gridSpacing } from 'store/constant';
import { get } from 'api';

import KeyboardArrowUpOutlinedIcon from '@mui/icons-material/KeyboardArrowUpOutlined';

export default function PopularCard({ isLoading }) {
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    get('/records/dashboard/summary').then((d) => setTopProducts(d.topProducts || [])).catch(() => {});
  }, []);

  return (
    <>
      {isLoading ? (
        <SkeletonPopularCard />
      ) : (
        <MainCard content={false}>
          <CardContent>
            <Stack sx={{ gap: gridSpacing }}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h4">Top Selling Products</Typography>
              </Stack>
              {topProducts.map((p, i) => (
                <Box key={p.name}>
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle1" sx={{ color: 'inherit' }}>
                      {p.name}
                    </Typography>
                    <Stack direction="row" sx={{ alignItems: 'center' }}>
                      <Typography variant="subtitle1" sx={{ color: 'inherit' }}>
                        {Number(p.revenue).toLocaleString()}
                      </Typography>
                      <Avatar
                        variant="rounded"
                        sx={{ width: 16, height: 16, borderRadius: '5px', bgcolor: 'success.light', color: 'success.dark', ml: 2 }}
                      >
                        <KeyboardArrowUpOutlinedIcon fontSize="small" color="inherit" />
                      </Avatar>
                    </Stack>
                  </Stack>
                  <Typography variant="subtitle2" sx={{ color: 'success.dark' }}>
                    Qty: {Number(p.qty).toLocaleString()}
                  </Typography>
                  {i < topProducts.length - 1 && <Divider sx={{ my: 1.5 }} />}
                </Box>
              ))}
              {topProducts.length === 0 && (
                <Typography variant="body2" color="text.secondary">No sales data yet</Typography>
              )}
            </Stack>
          </CardContent>
        </MainCard>
      )}
    </>
  );
}

PopularCard.propTypes = { isLoading: PropTypes.bool };
