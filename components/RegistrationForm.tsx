


import React, { useState, useRef } from 'react';
import { type EventConfig } from '../types';
import { type RegistrationFormState } from '../App';
import { TextInput } from './TextInput';
import { Spinner } from './Spinner';
import { DynamicFormField } from './DynamicFormField';
import { checkPasswordStrength, type PasswordStrengthResult } from '../utils/passwordStrength';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';

interface RegistrationFormProps {
  formData: RegistrationFormState;
  onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSubmit: () => void;
  onReset: () => void;
  isLoading: boolean;
  config: EventConfig['formFields'];
}

type FormErrors = Record<string, string>;

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
  formData,
  onFormChange,
  onSubmit,
  onReset,
  isLoading,
  config,
}) => {
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrengthResult>({ score: 0, label: '' });
  const formRef = useRef<HTMLFormElement>(null);
  
  const handleFormChangeInternal = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.target.name === 'password') {
        const newPassword = e.target.value;
        setPasswordStrength(checkPasswordStrength(newPassword));
    }
    onFormChange(e); // Propagate the change up to the parent
  };

  const validateField = (name: string, value: string | undefined, currentData: RegistrationFormState, currentConfirmPassword: string) => {
    switch (name) {
      case 'firstName':
        return !value?.trim() ? 'First Name is required.' : '';
      case 'lastName':
        return !value?.trim() ? 'Last Name is required.' : '';
      case 'email':
        if (!value?.trim()) return 'Email Address is required.';
        if (!/\S+@\S+\.\S+/.test(value)) return 'Please enter a valid email address.';
        return '';
      case 'password':
        if (!value) return 'Password is required.';
        if (value.length < 8) return 'Password must be at least 8 characters long.';
        if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(value)) return 'Password must contain at least one letter and one number.';
        return '';
      case 'confirmPassword':
        return currentData.password !== currentConfirmPassword ? 'Passwords do not match.' : '';
      default:
        const fieldConfig = config.find(field => field.id === name);
        if (fieldConfig?.enabled && fieldConfig?.required && !String(value || '').trim()) {
            return `${fieldConfig.label} is required.`;
        }
        return '';
    }
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    const currentConfirmPassword = name === 'confirmPassword' ? value : confirmPassword;
    const error = validateField(name, value, formData, currentConfirmPassword);
    
    setErrors(prev => {
        const newErrors: FormErrors = { ...prev, [name]: error };
        // If password is changed, re-validate confirm password if it exists
        if (name === 'password' && confirmPassword) {
            const confirmError = validateField('confirmPassword', confirmPassword, { ...formData, password: value }, confirmPassword);
            newErrors.confirmPassword = confirmError;
        }
        return newErrors;
    });
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    let firstErrorId: string | null = null;
    
    const allFieldIds = ['firstName', 'lastName', 'email', 'password', 'confirmPassword', ...config.filter(f => f.enabled).map(f => f.id)];

    for (const id of allFieldIds) {
        const value = id === 'confirmPassword' ? confirmPassword : formData[id];
        const error = validateField(id, value, formData, confirmPassword);
        if (error) {
            if (!firstErrorId) firstErrorId = id;
            newErrors[id] = error;
        }
    }
    
    setErrors(newErrors);

    if (firstErrorId) {
        const el = formRef.current?.querySelector<HTMLElement>(`[name="${firstErrorId}"]`);
        el?.focus();
        return false;
    }
    
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit();
    }
  };

  const handleResetClick = () => {
    setErrors({});
    setConfirmPassword('');
    setPasswordStrength({ score: 0, label: '' });
    onReset();
  };
  
  const renderErrorSummary = () => {
    const errorKeys = Object.keys(errors).filter(key => errors[key]);
    if (errorKeys.length === 0) return null;

    const allFields = [
      { id: 'firstName', label: 'First Name' },
      { id: 'lastName', label: 'Last Name' },
      { id: 'email', label: 'Email Address' },
      { id: 'password', label: 'Password' },
      { id: 'confirmPassword', label: 'Confirm Password' },
      ...config.filter(f => f.enabled)
    ];

    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, key: string) => {
        e.preventDefault();
        formRef.current?.querySelector<HTMLElement>(`[name="${key}"]`)?.focus();
    };

    return (
        <div role="alert" className="p-4 mb-6 border-l-4 rounded-r-lg bg-red-100 dark:bg-red-900 border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 animate-fade-in-down">
            <h3 className="font-bold">Please fix {errorKeys.length === 1 ? '1 error' : `${errorKeys.length} errors`} to continue:</h3>
            <ul className="list-disc list-inside mt-2 space-y-1">
                {errorKeys.map(key => {
                    const field = allFields.find(f => f.id === key);
                    return (
                        <li key={key}>
                            <a 
                                href={`#${key}`} 
                                onClick={(e) => handleLinkClick(e, key)}
                                className="underline hover:no-underline"
                            >
                                {field?.label || key}
                            </a>: {errors[key]}
                        </li>
                    )
                })}
            </ul>
        </div>
    );
};

  const enabledCustomFields = config.filter(field => field.enabled);

  return (
    <form onSubmit={handleSubmit} className="space-y-6" ref={formRef} noValidate>
      {renderErrorSummary()}
      
      {/* Core Fields */}
      <fieldset>
        <legend className="text-lg font-medium text-gray-900 dark:text-white mb-2">Your Account</legend>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TextInput
              label="First Name"
              name="firstName"
              value={formData.firstName}
              onChange={onFormChange}
              onBlur={handleBlur}
              placeholder="e.g. Jane"
              required
              error={errors.firstName}
            />
            <TextInput
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              onChange={onFormChange}
              onBlur={handleBlur}
              placeholder="e.g. Doe"
              required
              error={errors.lastName}
            />
          </div>
           <TextInput
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={onFormChange}
              onBlur={handleBlur}
              placeholder="e.g. jane.doe@example.com"
              required
              error={errors.email}
            />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <TextInput
                label="Password"
                name="password"
                type="password"
                value={formData.password || ''}
                onChange={handleFormChangeInternal}
                onBlur={handleBlur}
                placeholder="••••••••"
                required
                error={errors.password}
              />
              <PasswordStrengthIndicator strength={passwordStrength} />
            </div>
            <TextInput
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={handleBlur}
              placeholder="••••••••"
              required
              error={errors.confirmPassword}
            />
          </div>
        </div>
      </fieldset>
      
      {/* Custom Fields */}
      {enabledCustomFields.length > 0 && (
        <fieldset className="pt-6 border-t border-gray-200 dark:border-gray-700">
           <legend className="text-lg font-medium text-gray-900 dark:text-white mb-2">Additional Information</legend>
          <div className="space-y-6">
            {enabledCustomFields.map(field => (
              <DynamicFormField
                key={field.id}
                field={field}
                value={formData[field.id]}
                onChange={onFormChange}
                onBlur={handleBlur}
                error={errors[field.id]}
              />
            ))}
          </div>
        </fieldset>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-primary/70 disabled:cursor-not-allowed transition-all duration-300 ease-in-out"
        >
          {isLoading ? (
            <>
              <Spinner />
              Processing...
            </>
          ) : (
            'Register for Event'
          )}
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={handleResetClick}
          className="w-full sm:w-auto flex justify-center items-center py-3 px-6 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-in-out"
        >
          Reset Form
        </button>
      </div>
    </form>
  );
};