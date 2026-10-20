import { memo, useState, useMemo } from 'react';
import Activity from 'ui-component/Activity';

import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import NavItem from './NavItem';
import NavGroup from './NavGroup';
import menuItems from 'menu-items';
import useAuth from 'hooks/useAuth';

import { useGetMenuMaster } from 'api/menu';

// ==============================|| SIDEBAR MENU LIST ||============================== //

function MenuList() {
  const { menuMaster } = useGetMenuMaster();
  const drawerOpen = menuMaster.isDashboardDrawerOpened;
  const { role } = useAuth();

  const [selectedID, setSelectedID] = useState('');

  const lastItem = null;

  const filteredItems = useMemo(() => {
    return menuItems.items.map((group) => {
      if (group.children) {
        return { ...group, children: group.children.filter((item) => !item.roles || item.roles.includes(role)) };
      }
      return group;
    });
  }, [role]);

  let lastItemIndex = filteredItems.length - 1;
  let remItems = [];
  let lastItemId;

  if (lastItem && lastItem < filteredItems.length) {
    lastItemId = filteredItems[lastItem - 1].id;
    lastItemIndex = lastItem - 1;
    remItems = filteredItems.slice(lastItem - 1, filteredItems.length).map((item) => ({
      title: item.title,
      elements: item.children,
      icon: item.icon,
      ...(item.url && {
        url: item.url
      })
    }));
  }

  const navItems = filteredItems.slice(0, lastItemIndex + 1).map((item, index) => {
    switch (item.type) {
      case 'group':
        if (item.url && item.id !== lastItemId) {
          return (
            <List key={item.id}>
              <NavItem item={item} level={1} isParents setSelectedID={() => setSelectedID('')} />
              <Activity mode={index !== 0 ? 'visible' : 'hidden'}>
                <Divider sx={{ py: 0.5 }} />
              </Activity>
            </List>
          );
        }

        return (
          <NavGroup
            key={item.id}
            setSelectedID={setSelectedID}
            selectedID={selectedID}
            item={item}
            lastItem={lastItem}
            remItems={remItems}
            lastItemId={lastItemId}
          />
        );
      default:
        return (
          <Typography key={item.id} variant="h6" align="center" sx={{ color: 'error.main' }}>
            Menu Items Error
          </Typography>
        );
    }
  });

  return <Box {...(drawerOpen && { sx: { mt: 1.5 } })}>{navItems}</Box>;
}

export default memo(MenuList);
