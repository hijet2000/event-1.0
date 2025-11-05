import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

export const Logo: React.FC = () => {
  const { config } = useTheme();

  // Render a placeholder if config is not yet loaded
  if (!config) {
    return <div className="h-12 w-12 mx-auto mb-4 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>;
  }

  const { logoUrl, colorPrimary } = config.theme;

  if (logoUrl) {
    return (
      <img 
        src={logoUrl} 
        alt="Event Logo" 
        className="h-16 w-auto max-h-20 mx-auto mb-4 object-contain"
      />
    );
  }

  return (
    <svg 
      className="h-12 w-12 mx-auto mb-4" 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Event Logo"
    >
      <path 
        d="M50 0L93.3 25V75L50 100L6.7 75V25L50 0Z" 
        stroke={colorPrimary} 
        strokeWidth="8"
      />
      <path 
        d="M50 22L76.5 37V63L50 78L23.5 63V37L50 22Z" 
        fill={colorPrimary} 
      />
    </svg>
  );
};
