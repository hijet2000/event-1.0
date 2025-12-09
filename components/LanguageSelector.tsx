
import React from 'react';
import { useTranslation } from '../contexts/LanguageContext';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage } = useTranslation();

  return (
    <div className="flex items-center space-x-2">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.204 8.842l-2.244-2.713 2.941-4.329a1 1 0 011.66 1.108l-1.518 2.227 4.753 6.942a1 1 0 01-1.659 1.109l-3.937-5.748-1.518 2.227c-.258.378-.817.378-1.075 0z" />
      </svg>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as any)}
        className="bg-transparent text-sm text-gray-600 dark:text-gray-300 border-none focus:ring-0 cursor-pointer hover:text-primary transition-colors"
      >
        <option value="en">English</option>
        <option value="es">Español</option>
        <option value="fr">Français</option>
      </select>
    </div>
  );
};
