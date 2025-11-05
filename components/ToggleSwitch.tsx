
import React from 'react';

interface ToggleSwitchProps {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  name: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ label, enabled, onChange, name }) => {
  return (
    <label htmlFor={name} className="flex items-center justify-between cursor-pointer py-2">
      <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
      <div className="relative">
        <input
          type="checkbox"
          id={name}
          name={name}
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-14 h-8 rounded-full bg-gray-200 dark:bg-gray-600 peer-checked:bg-primary transition-colors"></div>
        <div className="absolute left-1 top-1 w-6 h-6 rounded-full bg-white transition-transform duration-300 ease-in-out peer-checked:translate-x-6"></div>
      </div>
    </label>
  );
};