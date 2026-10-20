import { createContext, useState, useCallback, useMemo } from 'react';
import { post, get } from 'api';

export const AuthContext = createContext(null);

const ROLES = {
  1: 'Admin',
  2: 'Production Manager',
  3: 'Sales Officer',
  4: 'Store Keeper',
  5: 'Accountant'
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email, password) => {
    const data = await post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const data = await get('/auth/me');
      setUser(data.user);
    } catch {
      logout();
    }
  }, [logout]);

  const updateUser = useCallback((updated) => {
    const stored = localStorage.getItem('user');
    const current = stored ? JSON.parse(stored) : {};
    const merged = { ...current, ...updated };
    localStorage.setItem('user', JSON.stringify(merged));
    setUser(merged);
  }, []);

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      checkAuth,
      updateUser,
      isAuthenticated: !!user,
      role: user ? ROLES[user.role_id] || 'Unknown' : null,
      roleId: user?.role_id || null
    }),
    [user, login, logout, checkAuth, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
