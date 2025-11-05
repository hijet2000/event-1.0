import React from 'react';
import { type PasswordStrengthResult } from '../utils/passwordStrength';

interface PasswordStrengthIndicatorProps {
  strength: PasswordStrengthResult;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ strength }) => {
  // Don't render if the password is too short or empty
  if (strength.score === 0) {
    return null;
  }

  // Maps score to corresponding colors and labels
  const strengthInfo = [
    { label: '', color: 'bg-gray-200 dark:bg-gray-600', textColor: '' },
    { label: 'Weak', color: 'bg-red-500', textColor: 'text-red-500' },
    { label: 'Medium', color: 'bg-orange-500', textColor: 'text-orange-500' },
    { label: 'Strong', color: 'bg-yellow-500', textColor: 'text-yellow-500' },
    { label: 'Very Strong', color: 'bg-green-500', textColor: 'text-green-500' },
  ];

  const currentStrength = strengthInfo[strength.score];

  return (
    <div className="mt-2 space-y-1 animate-fade-in">
      <div className="grid grid-cols-4 gap-x-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className={`h-1.5 rounded-full transition-colors ${
              index < strength.score ? currentStrength.color : strengthInfo[0].color
            }`}
          ></div>
        ))}
      </div>
      {strength.label && (
        <p className={`text-xs font-medium text-right ${currentStrength.textColor}`}>{strength.label}</p>
      )}
    </div>
  );
};
