
import React, { useState, useRef } from 'react';
import { type RegistrationData, type EventConfig } from '../types';
import { TextInput } from './TextInput';
import { Spinner } from './Spinner';
import { DynamicFormField } from './DynamicFormField';
import { checkPasswordStrength, type PasswordStrengthResult } from '../utils/passwordStrength';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';

interface RegistrationFormProps {
  formData: RegistrationData;
  onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
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

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    let firstErrorId: string | null = null;
    
    const setError = (fieldId: string, message: string) => {
        if (!firstErrorId) {
            firstErrorId = fieldId;
        }
        newErrors[fieldId] = message;
    };
    
    if (!formData.name.trim()) {
      setError('name', 'Full Name is required.');
    }

    if (!formData.email.trim()) {
      setError('email', 'Email Address is required.');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('email', 'Please enter a valid email address.');
    }

    if (!formData.password) {
      setError('password', 'Password is required.');
    } else if (formData.password.length < 8) {
      setError('password', 'Password must be at least 8 characters long.');
    } else if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(formData.password)) {
      setError('password', 'Password must contain at least one letter and one number.');
    }
    
    if (formData.password !== confirmPassword) {
        setError('confirmPassword', 'Passwords do not match.');
    }

    // Dynamic field validation
    config.forEach(field => {
      if (field.enabled && field.required && !formData[field.id]?.trim()) {
        setError(field.id, `${field.label} is required.`);
      }
    });

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
    const errorKeys = Object.keys(errors);
    if (errorKeys.length === 0) return null;

    const allFields = [
      { id: 'name', label: 'Full Name' },
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
        <div role="alert" className="p-4 mb-6 border-l-4 rounded-r-lg bg-red-100 dark:bg-red-900 border-red-400 dark:border-red-600 text-red-700 dark:text-red-200">
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
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={onFormChange}
              placeholder="e.g. Jane Doe"
              required
              error={errors.name}
            />
            <TextInput
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={onFormChange}
              placeholder="e.g. jane.doe@example.com"
              required
              error={errors.email}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <TextInput
                label="Password"
                name="password"
                type="password"
                value={formData.password || ''}
                onChange={handleFormChangeInternal}
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
           <legend className="text-lg font-medium text-gray-900 dark:text-white mb-2">Event Specific Information</legend>
          <div className="space-y-6">
            {enabledCustomFields.map(field => (
              <DynamicFormField
                key={field.id}
                field={field}
                value={formData[field.id]}
                onChange={onFormChange}
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
