import { useEffect, useRef, useState, useCallback } from 'react';
import { get as apiGet, put as apiPut, del as apiDel } from 'api';

import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Chip from '@mui/material/Chip';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import MainCard from 'ui-component/cards/MainCard';
import Transitions from 'ui-component/extended/Transitions';
import NotificationList from './NotificationList';
import useAppEvent from 'hooks/useAppEvent';

import { IconBell } from '@tabler/icons-react';

const status = [
  { value: 'all', label: 'All Notification' },
  { value: 'unread', label: 'Unread' }
];

export default function NotificationSection() {
  const theme = useTheme();
  const downMD = useMediaQuery(theme.breakpoints.down('md'));

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('all');
  const [notifications, setNotifications] = useState([]);

  const anchorRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiGet('/productions/notifications/list');
      setNotifications(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  useAppEvent('app:notification', fetchNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) return;
    setOpen(false);
  };

  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current === true && open === false) {
      anchorRef.current.focus();
    }
    prevOpen.current = open;
  }, [open]);

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    for (const n of unread) {
      try {
        await apiPut(`/productions/notifications/${n.id}/read`);
      } catch {
        /* silent */
      }
    }
    fetchNotifications();
  };

  const handleMarkRead = async (id) => {
    try {
      await apiPut(`/productions/notifications/${id}/read`);
      fetchNotifications();
    } catch {
      /* silent */
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiDel(`/productions/notifications/${id}`);
      fetchNotifications();
    } catch {
      /* silent */
    }
  };

  const handleDeleteAllRead = async () => {
    try {
      await apiDel('/productions/notifications/read/all');
      fetchNotifications();
    } catch {
      /* silent */
    }
  };

  const readCount = notifications.filter((n) => n.read).length;

  const filtered = value === 'all' ? notifications : notifications.filter((n) => !n.read);

  return (
    <>
      <Box sx={{ ml: 2 }}>
        <Avatar
          variant="rounded"
          sx={{
            ...theme.typography.commonAvatar,
            ...theme.typography.mediumAvatar,
            transition: 'all .2s ease-in-out',
            color: theme.vars.palette.warning.dark,
            background: theme.vars.palette.warning.light,
            '&:hover, &[aria-controls="menu-list-grow"]': {
              color: theme.vars.palette.warning.light,
              background: theme.vars.palette.warning.dark
            }
          }}
          ref={anchorRef}
          aria-controls={open ? 'menu-list-grow' : undefined}
          aria-haspopup="true"
          onClick={handleToggle}
        >
          <Badge badgeContent={unreadCount} color="error">
            <IconBell stroke={1.5} size="20px" />
          </Badge>
        </Avatar>
      </Box>
      <Popper
        placement={downMD ? 'bottom' : 'bottom-end'}
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
        modifiers={[{ name: 'offset', options: { offset: [downMD ? 5 : 0, 20] } }]}
      >
        {({ TransitionProps }) => (
          <ClickAwayListener onClickAway={handleClose}>
            <Transitions position={downMD ? 'top' : 'top-right'} in={open} {...TransitionProps}>
              <Paper>
                <MainCard border={false} elevation={16} content={false} boxShadow shadow={theme.shadows[16]} sx={{ maxWidth: 360 }}>
                  <Stack sx={{ gap: 2 }}>
                    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', pt: 2, px: 2 }}>
                      <Stack direction="row" sx={{ gap: 2 }}>
                        <Typography variant="subtitle1">Notifications</Typography>
                        {unreadCount > 0 && (
                          <Chip
                            size="small"
                            label={String(unreadCount).padStart(2, '0')}
                            variant="filled"
                            sx={{ color: 'background.default', bgcolor: 'warning.dark' }}
                          />
                        )}
                      </Stack>
                      <Stack direction="row" sx={{ gap: 1 }}>
                        {unreadCount > 0 && (
                          <Typography
                            component="span"
                            variant="subtitle2"
                            sx={{ color: 'primary.main', cursor: 'pointer' }}
                            onClick={handleMarkAllRead}
                          >
                            Mark all as read
                          </Typography>
                        )}
                        {readCount > 0 && (
                          <Typography
                            component="span"
                            variant="subtitle2"
                            sx={{ color: 'error.main', cursor: 'pointer' }}
                            onClick={handleDeleteAllRead}
                          >
                            Delete all read
                          </Typography>
                        )}
                      </Stack>
                    </Stack>
                    <Box sx={{ height: 1, maxHeight: 'calc(100vh - 205px)', overflowX: 'hidden', '&::-webkit-scrollbar': { width: 5 } }}>
                      <Box sx={{ px: 2, pt: 0.25 }}>
                        <TextField
                          select
                          fullWidth
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          slotProps={{ select: { native: true } }}
                        >
                          {status.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </TextField>
                      </Box>
                      <Divider sx={{ mt: 2 }} />
                      <NotificationList notifications={filtered} onMarkRead={handleMarkRead} onDelete={handleDelete} />
                    </Box>
                  </Stack>
                </MainCard>
              </Paper>
            </Transitions>
          </ClickAwayListener>
        )}
      </Popper>
    </>
  );
}
