
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
  switch (field.type) {
    case 'textarea':
      return (
        <div>
          <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {field.label}
            {field.required && <span aria-hidden="true" className="text-red-500 ml-1">*</span>}
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
            className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition ${error ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-primary focus:border-primary'}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${field.id}-error` : undefined}
          />
          {error && (
            <p id={`${field.id}-error`} className="mt-2 text-sm text-red-600 dark:text-red-400 animate-fade-in-down">
              {error}
            </p>
          )}
        </div>
      );
    case 'dropdown':
      return (
        <div>
          <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {field.label}
            {field.required && <span aria-hidden="true" className="text-red-500 ml-1">*</span>}
          </label>
          <select
            id={field.id}
            name={field.id}
            value={value || ''}
            onChange={onChange}
            onBlur={onBlur}
            required={field.required}
            aria-required={field.required}
            className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition ${error ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-primary focus:border-primary'}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${field.id}-error` : undefined}
          >
            <option value="">{field.placeholder || 'Select an option...'}</option>
            {field.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {error && (
            <p id={`${field.id}-error`} className="mt-2 text-sm text-red-600 dark:text-red-400 animate-fade-in-down">
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
