import { Navigate, useLocation } from 'react-router-dom';
import useAuth from 'hooks/useAuth';

export default function ProtectedRoute({ roles, children }) {
  const { user, role } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/pages/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(role)) {
    return <Navigate to="/dashboard/default" replace />;
  }

  return children;
}
