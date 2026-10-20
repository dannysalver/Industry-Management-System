import { useState } from 'react';
import PropTypes from 'prop-types';

import { useTheme } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import { withAlpha } from 'utils/colorUtils';
import { IconClock, IconCircleCheck, IconAlertTriangle, IconInfoCircle, IconTrash } from '@tabler/icons-react';

const typeConfig = {
  production: { icon: IconClock, color: 'warning' },
  info: { icon: IconInfoCircle, color: 'info' },
  success: { icon: IconCircleCheck, color: 'success' },
  warning: { icon: IconAlertTriangle, color: 'warning' }
};

function ListItemWrapper({ children, sx }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        p: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer',
        '&:hover': { bgcolor: withAlpha(theme.palette.grey[200], 0.3) },
        ...sx
      }}
    >
      {children}
    </Box>
  );
}

ListItemWrapper.propTypes = { children: PropTypes.node, sx: PropTypes.object };

export default function NotificationList({ notifications, onMarkRead, onDelete }) {
  const [expandedId, setExpandedId] = useState(null);

  const handleClick = (n) => {
    if (expandedId === n.id) {
      setExpandedId(null);
    } else {
      setExpandedId(n.id);
      if (!n.read) onMarkRead?.(n.id);
    }
  };

  const containerSX = { gap: 2, pl: 7 };

  if (!notifications || notifications.length === 0) {
    return (
      <List sx={{ width: '100%', maxWidth: { xs: 300, md: 330 }, py: 0 }}>
        <ListItemWrapper>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            No notifications
          </Typography>
        </ListItemWrapper>
      </List>
    );
  }

  return (
    <List sx={{ width: '100%', maxWidth: { xs: 300, md: 330 }, py: 0 }}>
      {notifications.map((n) => {
        const config = typeConfig[n.type] || typeConfig.info;
        const Icon = config.icon;
        const timeAgo = getTimeAgo(n.created_at);
        const isExpanded = expandedId === n.id;
        return (
          <ListItemWrapper key={n.id} sx={isExpanded ? { bgcolor: withAlpha('#000', 0.03) } : undefined}>
            <ListItem
              alignItems="center"
              disablePadding
              onClick={() => handleClick(n)}
              secondaryAction={
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                  <Typography variant="caption">{timeAgo}</Typography>
                </Stack>
              }
            >
              <ListItemAvatar>
                <Avatar sx={{ color: `${config.color}.dark`, bgcolor: `${config.color}.light` }}>
                  <Icon stroke={1.5} size="20px" />
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary={n.title} />
            </ListItem>
            {n.message && (
              <Stack sx={containerSX}>
                <Typography variant="subtitle2">{n.message}</Typography>
                {!n.read && <Chip label="Unread" color="error" size="small" sx={{ width: 'min-content' }} />}
              </Stack>
            )}
            <Collapse in={isExpanded}>
              <Box sx={{ pl: 7, pr: 1, pt: 1 }}>
                <Divider sx={{ mb: 1 }} />
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    {new Date(n.created_at).toLocaleString()}
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<IconTrash size={16} />}
                    onClick={(e) => { e.stopPropagation(); onDelete?.(n.id); }}
                  >
                    Delete
                  </Button>
                </Stack>
              </Box>
            </Collapse>
          </ListItemWrapper>
        );
      })}
    </List>
  );
}

NotificationList.propTypes = {
  notifications: PropTypes.array,
  onMarkRead: PropTypes.func,
  onDelete: PropTypes.func
};

function getTimeAgo(dateStr) {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
