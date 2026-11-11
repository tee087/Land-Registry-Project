import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, onSessionExpired, tokenStore } from '../api/client.js';
import { AuthContext } from './authContext.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!tokenStore.access) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.me();
        if (active) setUser(data);
      } catch {
        tokenStore.clear();
      } finally {
        if (active) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => onSessionExpired(() => {
    setUser(null);
    setSessionExpired(true);
    setError('Your session has expired. Please sign in again.');
  }), []);

  const login = useCallback(async (email, password) => {
    setError(null);
    setSessionExpired(false);
    try {
      const { data } = await api.login({ email, password });
      tokenStore.set(data);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const register = useCallback(async (input) => {
    setError(null);
    setSessionExpired(false);
    try {
      const { data } = await api.register(input);
      tokenStore.set(data);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.me();
    setUser(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.refresh;
    try {
      if (refreshToken) await api.logout(refreshToken);
    } catch {
      // Local logout must still succeed if the server is unreachable.
    }
    tokenStore.clear();
    setUser(null);
    setError(null);
    setSessionExpired(false);
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, sessionExpired, setError, login, register, logout, refreshUser }),
    [user, loading, error, sessionExpired, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
