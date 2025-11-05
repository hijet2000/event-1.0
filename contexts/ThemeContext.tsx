
import React, { useState, useEffect, useContext, createContext, useCallback } from 'react';
import { type EventConfig } from '../types';
import { getPublicEventData } from '../server/api';

interface ThemeContextType {
  config: EventConfig | null;
  registrationCount: number;
  isLoading: boolean;
  error: string | null;
  updateConfig: (newConfig: EventConfig) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  config: null,
  registrationCount: 0,
  isLoading: true,
  error: null,
  updateConfig: () => {},
});

const applyTheme = (cfg: EventConfig) => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', cfg.theme.colorPrimary);
    root.style.setProperty('--color-secondary', cfg.theme.colorSecondary);
    root.style.setProperty('--font-family', `'${cfg.theme.fontFamily}', sans-serif`);
    
    if (!root.classList.contains('dark')) {
        root.style.setProperty('--color-background-color', cfg.theme.backgroundColor);
    }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [registrationCount, setRegistrationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublicEventData()
      .then(({ config: cfg, registrationCount: count }) => {
        setConfig(cfg);
        setRegistrationCount(count);
        applyTheme(cfg);
        setError(null);
      })
      .catch(() => {
        setError('Failed to load event configuration. There might be a connection issue.');
        setConfig(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const updateConfig = useCallback((newConfig: EventConfig) => {
    setConfig(newConfig);
    applyTheme(newConfig);
  }, []);

  const value = { config, registrationCount, isLoading, error, updateConfig };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
