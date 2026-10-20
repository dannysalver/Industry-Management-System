import Typography from '@mui/material/Typography';

export default function AuthFooter() {
  return (
    <Typography variant="body2" color="text.secondary" align="center">
      &copy; {new Date().getFullYear()} IDMS. All rights reserved.
    </Typography>
  );
}
