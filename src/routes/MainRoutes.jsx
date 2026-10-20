import { lazy } from 'react';

import MainLayout from 'layout/MainLayout';
import Loadable from 'ui-component/Loadable';
import ProtectedRoute from 'ui-component/ProtectedRoute';

const DashboardDefault = Loadable(lazy(() => import('views/dashboard/Default')));
const Materials = Loadable(lazy(() => import('views/materials')));
const Products = Loadable(lazy(() => import('views/products')));
const Production = Loadable(lazy(() => import('views/production')));
const Stock = Loadable(lazy(() => import('views/stock')));
const Sales = Loadable(lazy(() => import('views/sales')));
const Expenses = Loadable(lazy(() => import('views/expenses')));
const Records = Loadable(lazy(() => import('views/records')));
const Sources = Loadable(lazy(() => import('views/sources')));
const Clients = Loadable(lazy(() => import('views/clients')));
const Users = Loadable(lazy(() => import('views/users')));

const R = ({ roles, children }) => <ProtectedRoute roles={roles}>{children}</ProtectedRoute>;

const MainRoutes = {
  path: '/',
  element: <MainLayout />,
  children: [
    {
      index: true,
      element: <R><DashboardDefault /></R>
    },
    {
      path: 'dashboard',
      children: [
        {
          path: 'default',
          element: <R><DashboardDefault /></R>
        }
      ]
    },
    {
      path: 'materials',
      element: <R roles={['Admin', 'Production Manager', 'Store Keeper']}><Materials /></R>
    },
    {
      path: 'products',
      element: <R roles={['Admin', 'Production Manager', 'Store Keeper']}><Products /></R>
    },
    {
      path: 'production',
      element: <R roles={['Admin', 'Production Manager']}><Production /></R>
    },
    {
      path: 'stock',
      element: <R roles={['Admin', 'Production Manager', 'Store Keeper']}><Stock /></R>
    },
    {
      path: 'sales',
      element: <R roles={['Admin', 'Sales Officer', 'Accountant']}><Sales /></R>
    },
    {
      path: 'expenses',
      element: <R roles={['Admin', 'Sales Officer', 'Accountant']}><Expenses /></R>
    },
    {
      path: 'records',
      element: <R><Records /></R>
    },
    {
      path: 'sources',
      element: <R roles={['Admin', 'Sales Officer', 'Accountant']}><Sources /></R>
    },
    {
      path: 'clients',
      element: <R roles={['Admin', 'Sales Officer', 'Accountant']}><Clients /></R>
    },
    {
      path: 'users',
      element: <R roles={['Admin']}><Users /></R>
    }
  ]
};

export default MainRoutes;
