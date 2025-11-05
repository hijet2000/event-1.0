import React from 'react';

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export const Alert: React.FC<AlertProps> = ({ type, message }) => {
  const baseClasses = 'p-4 rounded-md text-sm';
  const typeClasses = {
    success: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    error: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    warning: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    info: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
  };

  if (!message) return null;

  return (
    <div className={`${baseClasses} ${typeClasses[type]}`} role="alert">
      <p>{message}</p>
    </div>
  );
};
