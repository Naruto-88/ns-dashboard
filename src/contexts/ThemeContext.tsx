import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeType = 'midnight' | 'mission' | 'white';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeType>(() => {
    return (localStorage.getItem('app-theme') as ThemeType) || 'midnight';
  });

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
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
