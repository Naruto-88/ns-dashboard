import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeType = 'midnight' | 'mission' | 'white';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>('midnight');

  useEffect(() => {
    // Fetch global theme on mount
    fetch('/api/settings/theme')
      .then(res => res.json())
      .then(data => {
        if (data.theme) {
          setThemeState(data.theme);
        }
      })
      .catch(console.error);
  }, []);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    fetch('/api/settings/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: newTheme })
    }).catch(console.error);
  };

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('theme-midnight', 'theme-mission', 'theme-white');
    root.classList.add(`theme-${theme}`);
    
    // Update data-theme for css variable switching if needed
    root.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
