
import React from 'react';
import { type FormField } from '../types';
import { TextInput } from './TextInput';

interface DynamicFormFieldProps {
  field: FormField;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  error?: string;
}

export const DynamicFormField: React.FC<DynamicFormFieldProps> = ({ field, value, onChange, onBlur, error }) => {
  const baseClasses = 'appearance-none block w-full px-5 py-4 border-2 rounded-2xl shadow-sm focus:outline-none focus:ring-8 sm:text-sm font-medium transition-all duration-300';
  const errorClasses = 'border-red-400 dark:border-red-500 focus:ring-red-500/10 focus:border-red-500 bg-red-50/30';
  const defaultClasses = 'border-gray-200 dark:border-gray-700 focus:ring-primary/10 focus:border-primary bg-white dark:bg-gray-950 text-gray-900 dark:text-white';

  switch (field.type) {
    case 'textarea':
      return (
        <div className="relative group">
          <label htmlFor={field.id} className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-2.5 ml-1 transition-colors group-focus-within:text-primary">
            {field.label}
            {field.required && <span aria-hidden="true" className="text-primary ml-1.5 opacity-50">•</span>}
          </label>
          <textarea
            id={field.id}
            name={field.id}
            rows={4}
            value={value || ''}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={field.placeholder}
            required={field.required}
            aria-required={field.required}
            className={`${baseClasses} ${error ? errorClasses : defaultClasses}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${field.id}-error` : undefined}
          />
          {error && (
            <p id={`${field.id}-error`} className="absolute -bottom-5 left-1 text-[10px] font-bold text-red-500 uppercase tracking-wider animate-fade-in-down">
              {error}
            </p>
          )}
        </div>
      );
    case 'dropdown':
      return (
        <div className="relative group">
          <label htmlFor={field.id} className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-2.5 ml-1 transition-colors group-focus-within:text-primary">
            {field.label}
            {field.required && <span aria-hidden="true" className="text-primary ml-1.5 opacity-50">•</span>}
          </label>
          <div className="relative">
            <select
              id={field.id}
              name={field.id}
              value={value || ''}
              onChange={onChange}
              onBlur={onBlur}
              required={field.required}
              aria-required={field.required}
              className={`${baseClasses} ${error ? errorClasses : defaultClasses} pr-12 cursor-pointer`}
              aria-invalid={!!error}
              aria-describedby={error ? `${field.id}-error` : undefined}
            >
              <option value="" className="text-gray-400">{field.placeholder || 'Select an option...'}</option>
              {field.options?.map(option => (
                <option key={option} value={option} className="text-gray-900 dark:text-white">{option}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7"/></svg>
            </div>
          </div>
          {error && (
            <p id={`${field.id}-error`} className="absolute -bottom-5 left-1 text-[10px] font-bold text-red-500 uppercase tracking-wider animate-fade-in-down">
              {error}
            </p>
          )}
        </div>
      );
    case 'text':
    default:
      return (
        <TextInput
          label={field.label}
          name={field.id}
          value={value || ''}
          onChange={onChange as (e: React.ChangeEvent<HTMLInputElement>) => void}
          onBlur={onBlur as (e: React.FocusEvent<HTMLInputElement>) => void}
          placeholder={field.placeholder}
          required={field.required}
          error={error}
        />
      );
  }
};
