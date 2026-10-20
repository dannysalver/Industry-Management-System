import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';

import Chip from '@mui/material/Chip';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'ui-component/cards/MainCard';
import SkeletonPopularCard from 'ui-component/cards/Skeleton/PopularCard';
import { gridSpacing } from 'store/constant';
import { get } from 'api';

const statusColors = {
  'In Progress': 'info',
  'Pending Completion': 'warning'
};

export default function InProgressProductions({ isLoading }) {
  const [productions, setProductions] = useState([]);

  useEffect(() => {
    get('/records/dashboard/summary')
      .then((d) => setProductions(d.runningProductionsDetailed || []))
      .catch(() => {});
  }, []);

  return (
    <>
      {isLoading ? (
        <SkeletonPopularCard />
      ) : (
        <MainCard content={false}>
          <CardContent>
            <Stack sx={{ gap: gridSpacing }}>
              <Typography variant="h4">Running Productions</Typography>
              {productions.map((p, i) => (
                <div key={p.id}>
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle1" sx={{ color: 'inherit' }}>
                      {p.product_name}
                    </Typography>
                    <Chip label={p.status} color={statusColors[p.status] || 'default'} size="small" />
                  </Stack>
                  {i < productions.length - 1 && <Divider sx={{ my: 1.5 }} />}
                </div>
              ))}
              {productions.length === 0 && (
                <Typography variant="body2" color="text.secondary">No running productions</Typography>
              )}
            </Stack>
          </CardContent>
        </MainCard>
      )}
    </>
  );
}

InProgressProductions.propTypes = { isLoading: PropTypes.bool };
