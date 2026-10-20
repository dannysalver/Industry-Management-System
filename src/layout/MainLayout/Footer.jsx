import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function Footer() {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'center', pt: 3, mt: 'auto' }}>
      <Typography variant="caption" color="text.secondary">
        &copy; {new Date().getFullYear()} IDMS. All rights reserved.
      </Typography>
    </Stack>
  );
}
