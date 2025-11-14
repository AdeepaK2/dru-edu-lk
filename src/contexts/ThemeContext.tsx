'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeType = 'default' | 'ben10' | 'tinkerbell' | 'cricketverse' | 'bounceworld' | 'avengers' | 'ponyville';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>('default');
  const [isClient, setIsClient] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    setIsClient(true);
    const savedTheme = localStorage.getItem('student-theme') as ThemeType | null;
    if (savedTheme === 'default' || savedTheme === 'ben10' || savedTheme === 'tinkerbell' || savedTheme === 'cricketverse' || savedTheme === 'bounceworld' || savedTheme === 'avengers' || savedTheme === 'ponyville') {
      setThemeState(savedTheme);
      applyTheme(savedTheme);
    } else {
      // Handle legacy 'normal' theme
      if (savedTheme === 'normal') {
        setThemeState('cricketverse');
        localStorage.setItem('student-theme', 'cricketverse');
        applyTheme('cricketverse');
      } else {
        applyTheme('default');
      }
    }
  }, []);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem('student-theme', newTheme);
    applyTheme(newTheme);
  };

  const applyTheme = (selectedTheme: ThemeType) => {
    const root = document.documentElement;

    if (selectedTheme === 'default') {
      // Default Theme - Clean Black and White (Teacher-style)
      root.style.setProperty('--theme-primary-light', '#60a5fa');
      root.style.setProperty('--theme-primary', '#0284c7');
      root.style.setProperty('--theme-primary-dark', '#0369a1');
      root.style.setProperty('--theme-secondary', '#475569');
      root.style.setProperty('--theme-accent', '#0ea5e9');
      root.style.setProperty('--theme-bg-light', '#ffffff');
      root.style.setProperty('--theme-bg-dark', '#1e293b');
    } else if (selectedTheme === 'ben10') {
      // Ben10 Theme - Green and Black
      root.style.setProperty('--theme-primary-light', '#4ade80');
      root.style.setProperty('--theme-primary', '#22c55e');
      root.style.setProperty('--theme-primary-dark', '#16a34a');
      root.style.setProperty('--theme-secondary', '#000000');
      root.style.setProperty('--theme-accent', '#84cc16');
      root.style.setProperty('--theme-bg-light', '#f0fdf4');
      root.style.setProperty('--theme-bg-dark', '#1b4332');
    } else if (selectedTheme === 'tinkerbell') {
      // Tinkerbell Theme - Pink and Purple
      root.style.setProperty('--theme-primary-light', '#f472b6');
      root.style.setProperty('--theme-primary', '#ec4899');
      root.style.setProperty('--theme-primary-dark', '#be185d');
      root.style.setProperty('--theme-secondary', '#7c3aed');
      root.style.setProperty('--theme-accent', '#a855f7');
      root.style.setProperty('--theme-bg-light', '#fef2f8');
      root.style.setProperty('--theme-bg-dark', '#500724');
    } else if (selectedTheme === 'cricketverse') {
      // CricketVerse Theme - Blue and White (renamed from normal)
      root.style.setProperty('--theme-primary-light', '#60a5fa');
      root.style.setProperty('--theme-primary', '#3b82f6');
      root.style.setProperty('--theme-primary-dark', '#1e40af');
      root.style.setProperty('--theme-secondary', '#ffffff');
      root.style.setProperty('--theme-accent', '#6366f1');
      root.style.setProperty('--theme-bg-light', '#f8fafc');
      root.style.setProperty('--theme-bg-dark', '#1e293b');
    } else if (selectedTheme === 'bounceworld') {
      // BounceWorld Theme - White, Blue (#1D428A), and Red (#C8102E)
      root.style.setProperty('--theme-primary-light', '#3B82F6');
      root.style.setProperty('--theme-primary', '#1D428A');
      root.style.setProperty('--theme-primary-dark', '#1e3a8a');
      root.style.setProperty('--theme-secondary', '#C8102E');
      root.style.setProperty('--theme-accent', '#ef4444');
      root.style.setProperty('--theme-bg-light', '#ffffff');
      root.style.setProperty('--theme-bg-dark', '#1D428A');
    } else if (selectedTheme === 'avengers') {
      // Avengers Theme - Midnight Blue variations with Rosy Brown and Slate Blue
      root.style.setProperty('--theme-primary-light', '#604AC7');
      root.style.setProperty('--theme-primary', '#2C1267');
      root.style.setProperty('--theme-primary-dark', '#0F0826');
      root.style.setProperty('--theme-secondary', '#C88DA5');
      root.style.setProperty('--theme-accent', '#4F2C8D');
      root.style.setProperty('--theme-bg-light', '#f8fafc');
      root.style.setProperty('--theme-bg-dark', '#0F0826');
    } else if (selectedTheme === 'ponyville') {
      // Ponyville Funland - Cotton candy pinks
      root.style.setProperty('--theme-primary-light', '#ff2e9f');
      root.style.setProperty('--theme-primary', '#e13690');
      root.style.setProperty('--theme-primary-dark', '#f1aed5');
      root.style.setProperty('--theme-secondary', '#ffffff');
      root.style.setProperty('--theme-accent', '#ff2e9f');
      root.style.setProperty('--theme-bg-light', '#fff5fb');
      root.style.setProperty('--theme-bg-dark', '#5a0033');
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
