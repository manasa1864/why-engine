import React, { createContext, useContext, useState, useEffect } from 'react';
const Ctx = createContext();
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('why_theme') || 'dark');
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('why_theme', theme); }, [theme]);
  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
