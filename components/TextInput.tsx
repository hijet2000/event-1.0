
import React from 'react';

interface TextInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  type = 'text',
  placeholder,
  required = false,
  error,
}) => {
  const errorClasses = 'border-red-400 dark:border-red-500 focus:ring-red-500/10 focus:border-red-500 bg-red-50/30';
  const defaultClasses = 'border-gray-200 dark:border-gray-700 focus:ring-primary/10 focus:border-primary bg-white dark:bg-gray-950';
  
  return (
    <div className="relative group">
      <label htmlFor={name} className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-2.5 ml-1 transition-colors group-focus-within:text-primary">
        {label}
        {required && <span aria-hidden="true" className="text-primary ml-1.5 opacity-50">•</span>}
      </label>
      <input
        type={type}
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        aria-required={required}
        className={`appearance-none block w-full px-5 py-4 border-2 rounded-2xl shadow-sm placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-8 sm:text-sm text-gray-900 dark:text-white font-medium transition-all duration-300 ${error ? errorClasses : defaultClasses}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && (
        <div className="absolute -bottom-6 left-1 flex items-center gap-1.5 text-red-500">
           <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
           <p id={`${name}-error`} className="text-[10px] font-bold uppercase tracking-wider animate-fade-in-down">
             {error}
           </p>
        </div>
      )}
    </div>
  );
};
