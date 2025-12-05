
import React from 'react';
import { type PasswordStrengthResult } from '../utils/passwordStrength';

interface PasswordStrengthIndicatorProps {
  strength: PasswordStrengthResult;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ strength }) => {
  // Don't render if the score is 0 and no label (empty input)
  if (strength.score === 0 && !strength.label) {
    return null;
  }

  // Maps score to corresponding colors and labels
  const strengthInfo = [
    { color: 'bg-gray-200 dark:bg-gray-700', textColor: 'text-gray-400' }, // 0
    { color: 'bg-red-500', textColor: 'text-red-500' },       // 1
    { color: 'bg-orange-500', textColor: 'text-orange-500' }, // 2
    { color: 'bg-yellow-500', textColor: 'text-yellow-500' }, // 3
    { color: 'bg-green-500', textColor: 'text-green-500' },   // 4
  ];

  const currentStrength = strengthInfo[strength.score];

  return (
    <div className="mt-2 space-y-1 animate-fade-in">
      <div className="flex gap-1 h-1.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className={`flex-1 rounded-full transition-all duration-300 ${
              index < strength.score ? currentStrength.color : 'bg-gray-200 dark:bg-gray-700'
            }`}
          ></div>
        ))}
      </div>
      {strength.label && (
        <p className={`text-xs font-medium text-right ${currentStrength.textColor}`}>
            {strength.label}
        </p>
      )}
    </div>
  );
};
