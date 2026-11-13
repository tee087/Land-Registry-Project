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

  const acceptSession = useCallback((data) => {
    tokenStore.set(data);
    setUser(data.user);
    setSessionExpired(false);
    return data;
  }, []);

  const login = useCallback(async (email, password, mfaCode, captchaToken, rememberMe = false) => {
    setError(null);
    setSessionExpired(false);
    try {
      const { data } = await api.login({ email, password, rememberMe, ...(mfaCode ? { mfaCode } : {}), ...(captchaToken ? { captchaToken } : {}) });
      acceptSession(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [acceptSession]);

  const register = useCallback(async (input) => {
    setError(null);
    setSessionExpired(false);
    try {
      const { data } = await api.register(input);
      if (data.accessToken) {
        tokenStore.set(data);
        setUser(data.user);
      }
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const googleAuth = useCallback(async (input) => {
    setError(null);
    setSessionExpired(false);
    try {
      const { data } = await api.googleAuth(input);
      acceptSession(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [acceptSession]);

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
    () => ({ user, loading, error, sessionExpired, setError, login, register, googleAuth, logout, refreshUser, acceptSession }),
    [user, loading, error, sessionExpired, login, register, googleAuth, logout, refreshUser, acceptSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
