'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeType = 'ben10' | 'tinkerbell';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>('ben10');
  const [isClient, setIsClient] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    setIsClient(true);
    const savedTheme = localStorage.getItem('student-theme') as ThemeType | null;
    if (savedTheme === 'ben10' || savedTheme === 'tinkerbell') {
      setThemeState(savedTheme);
      applyTheme(savedTheme);
    } else {
      applyTheme('ben10');
    }
  }, []);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem('student-theme', newTheme);
    applyTheme(newTheme);
  };

  const applyTheme = (selectedTheme: ThemeType) => {
    const root = document.documentElement;
    
    if (selectedTheme === 'ben10') {
      // Ben10 Theme - Green and Black
      root.style.setProperty('--theme-primary-light', '#4ade80');
      root.style.setProperty('--theme-primary', '#22c55e');
      root.style.setProperty('--theme-primary-dark', '#16a34a');
      root.style.setProperty('--theme-secondary', '#000000');
      root.style.setProperty('--theme-accent', '#84cc16');
      root.style.setProperty('--theme-bg-light', '#f0fdf4');
      root.style.setProperty('--theme-bg-dark', '#1b4332');
    } else if (selectedTheme === 'tinkerbell') {
      // Tinkerbell Theme - Green and Gold (lighter than Ben10)
      root.style.setProperty('--theme-primary-light', '#86efac');
      root.style.setProperty('--theme-primary', '#4ade80');
      root.style.setProperty('--theme-primary-dark', '#22c55e');
      root.style.setProperty('--theme-secondary', '#eab308');
      root.style.setProperty('--theme-accent', '#facc15');
      root.style.setProperty('--theme-bg-light', '#f7fdee');
      root.style.setProperty('--theme-bg-dark', '#365314');
    }
  };

  if (!isClient) {
    return children;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
