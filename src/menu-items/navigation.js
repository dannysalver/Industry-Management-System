import {
  IconBox,
  IconClipboardList,
  IconBuildingFactory2,
  IconPackages,
  IconShoppingCart,
  IconCoin,
  IconReport,
  IconTruckDelivery,
  IconUsers,
  IconUserPlus
} from '@tabler/icons-react';

const icons = {
  IconBox,
  IconClipboardList,
  IconBuildingFactory2,
  IconPackages,
  IconShoppingCart,
  IconCoin,
  IconReport,
  IconTruckDelivery,
  IconUsers,
  IconUserPlus
};

const allRoles = ['Admin', 'Production Manager', 'Sales Officer', 'Store Keeper', 'Accountant'];

const navigation = {
  id: 'navigation',
  title: 'Navigation',
  type: 'group',
  children: [
    {
      id: 'materials',
      title: 'Materials',
      type: 'item',
      url: '/materials',
      icon: icons.IconBox,
      breadcrumbs: false,
      roles: ['Admin', 'Production Manager', 'Store Keeper']
    },
    {
      id: 'products',
      title: 'Products',
      type: 'item',
      url: '/products',
      icon: icons.IconClipboardList,
      breadcrumbs: false,
      roles: ['Admin', 'Production Manager', 'Store Keeper']
    },
    {
      id: 'production',
      title: 'Production',
      type: 'item',
      url: '/production',
      icon: icons.IconBuildingFactory2,
      breadcrumbs: false,
      roles: ['Admin', 'Production Manager']
    },
    {
      id: 'stock',
      title: 'Stock',
      type: 'item',
      url: '/stock',
      icon: icons.IconPackages,
      breadcrumbs: false,
      roles: ['Admin', 'Production Manager', 'Store Keeper']
    },
    {
      id: 'sales',
      title: 'Sales',
      type: 'item',
      url: '/sales',
      icon: icons.IconShoppingCart,
      breadcrumbs: false,
      roles: ['Admin', 'Sales Officer', 'Accountant']
    },
    {
      id: 'expenses',
      title: 'Expenses',
      type: 'item',
      url: '/expenses',
      icon: icons.IconCoin,
      breadcrumbs: false,
      roles: ['Admin', 'Sales Officer', 'Accountant']
    },
    {
      id: 'records',
      title: 'Records',
      type: 'item',
      url: '/records',
      icon: icons.IconReport,
      breadcrumbs: false,
      roles: allRoles
    },
    {
      id: 'sources',
      title: 'Sources',
      type: 'item',
      url: '/sources',
      icon: icons.IconTruckDelivery,
      breadcrumbs: false,
      roles: ['Admin', 'Sales Officer', 'Accountant']
    },
    {
      id: 'clients',
      title: 'Clients',
      type: 'item',
      url: '/clients',
      icon: icons.IconUsers,
      breadcrumbs: false,
      roles: ['Admin', 'Sales Officer', 'Accountant']
    },
    {
      id: 'users',
      title: 'Users',
      type: 'item',
      url: '/users',
      icon: icons.IconUserPlus,
      breadcrumbs: false,
      roles: ['Admin']
    }
  ]
};

export default navigation;
