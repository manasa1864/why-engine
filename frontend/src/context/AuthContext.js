import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
const Ctx = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = localStorage.getItem('why_token');
    if (t) api.get('/auth/me').then(r => setUser(r.data.user)).catch(() => localStorage.removeItem('why_token')).finally(() => setLoading(false));
    else setLoading(false);
  }, []);
  const login = useCallback(async (email, pw) => { const { data } = await api.post('/auth/login', { email, password: pw }); localStorage.setItem('why_token', data.token); setUser(data.user); }, []);
  const register = useCallback(async (username, email, pw) => { const { data } = await api.post('/auth/register', { username, email, password: pw }); localStorage.setItem('why_token', data.token); setUser(data.user); }, []);
  const logout = useCallback(() => { localStorage.removeItem('why_token'); setUser(null); }, []);
  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
