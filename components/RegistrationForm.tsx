
import React, { useState, useRef, useEffect } from 'react';
import { type EventConfig, type TicketTier } from '../types';
import { type RegistrationFormState } from '../App';
import { TextInput } from './TextInput';
import { Spinner } from './Spinner';
import { DynamicFormField } from './DynamicFormField';
import { checkPasswordStrength, type PasswordStrengthResult } from '../utils/passwordStrength';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { useTranslation } from '../contexts/LanguageContext';

interface RegistrationFormProps {
  formData: RegistrationFormState;
  onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSubmit: () => void;
  onReset: () => void;
  isLoading: boolean;
  config: EventConfig['formFields'];
  ticketTiers?: TicketTier[];
}

type FormErrors = Record<string, string>;

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
  formData,
  onFormChange,
  onSubmit,
  onReset,
  isLoading,
  config,
  ticketTiers = []
}) => {
  const { t } = useTranslation();
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrengthResult>({ score: 0, label: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const activeTicketTiers = ticketTiers.filter(t => t.active);

  // Initialize password strength if form data already has password
  useEffect(() => {
    if (formData.password) {
      setPasswordStrength(checkPasswordStrength(formData.password));
    }
  }, []);
  
  const handleFormChangeInternal = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'password') {
        setPasswordStrength(checkPasswordStrength(value));
        // Real-time validation for password match if confirm password has been touched
        if (touched.confirmPassword && confirmPassword) {
             setErrors(prev => ({
                 ...prev,
                 confirmPassword: value !== confirmPassword ? 'Passwords do not match.' : ''
             }));
        }
    }
    
    // Clear error on change if it exists
    if (errors[name]) {
        setErrors(prev => ({ ...prev, [name]: '' }));
    }

    onFormChange(e); 
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setConfirmPassword(val);
      if (touched.confirmPassword) {
          setErrors(prev => ({
              ...prev,
              confirmPassword: val !== formData.password ? 'Passwords do not match.' : ''
          }));
      }
  };

  const handleTicketSelect = (tierId: string) => {
      // Create a synthetic event to reuse onFormChange logic
      const syntheticEvent = {
          target: { name: 'ticketTierId', value: tierId }
      } as React.ChangeEvent<HTMLInputElement>;
      
      onFormChange(syntheticEvent);
      if (errors.ticketTierId) {
          setErrors(prev => ({ ...prev, ticketTierId: '' }));
      }
  };

  const validateField = (name: string, value: string | undefined, currentData: RegistrationFormState, currentConfirmPassword: string) => {
    switch (name) {
      case 'firstName':
        return !value?.trim() ? `${t('form.firstName')} ${t('form.required').toLowerCase()}.` : '';
      case 'lastName':
        return !value?.trim() ? `${t('form.lastName')} ${t('form.required').toLowerCase()}.` : '';
      case 'email':
        if (!value?.trim()) return `${t('form.email')} ${t('form.required').toLowerCase()}.`;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address.';
        return '';
      case 'password':
        if (!value) return `${t('form.password')} ${t('form.required').toLowerCase()}.`;
        if (value.length < 8) return 'Password must be at least 8 characters long.';
        return '';
      case 'confirmPassword':
        return currentData.password !== currentConfirmPassword ? 'Passwords do not match.' : '';
      case 'ticketTierId':
        return activeTicketTiers.length > 0 && !value ? 'Please select a ticket option.' : '';
      default:
        const fieldConfig = config.find(field => field.id === name);
        if (fieldConfig?.enabled && fieldConfig?.required && !String(value || '').trim()) {
            return `${fieldConfig.label} ${t('form.required').toLowerCase()}.`;
        }
        return '';
    }
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    
    const currentConfirmPassword = name === 'confirmPassword' ? value : confirmPassword;
    const error = validateField(name, value, formData, currentConfirmPassword);
    
    setErrors(prev => {
        const newErrors: FormErrors = { ...prev, [name]: error };
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
    
    const allFieldIds = ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'ticketTierId', ...config.filter(f => f.enabled).map(f => f.id)];

    for (const id of allFieldIds) {
        const value = id === 'confirmPassword' ? confirmPassword : formData[id];
        const error = validateField(id, value, formData, confirmPassword);
        if (error) {
            if (!firstErrorId) firstErrorId = id;
            newErrors[id] = error;
        }
    }
    
    setErrors(newErrors);
    setTouched(allFieldIds.reduce((acc, id) => ({ ...acc, [id]: true }), {}));

    if (firstErrorId) {
        const el = formRef.current?.querySelector<HTMLElement>(`[name="${firstErrorId}"]`) || document.getElementById('ticket-section');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    setTouched({});
    setConfirmPassword('');
    setPasswordStrength({ score: 0, label: '' });
    onReset();
  };
  
  const renderErrorSummary = () => {
    const errorKeys = Object.keys(errors).filter(key => errors[key]);
    if (errorKeys.length === 0) return null;

    return (
        <div role="alert" className="p-4 mb-6 border-l-4 rounded-r-lg bg-red-50 dark:bg-red-900/30 border-red-500 dark:border-red-500 text-red-700 dark:text-red-300 animate-fade-in-down shadow-sm">
            <h3 className="font-bold flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Please correct the errors below
            </h3>
        </div>
    );
  };

  const enabledCustomFields = config.filter(field => field.enabled);

  return (
    <form onSubmit={handleSubmit} className="space-y-8" ref={formRef} noValidate>
      {renderErrorSummary()}
      
      {/* Ticket Selection */}
      {activeTicketTiers.length > 0 && (
          <div id="ticket-section" className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold mr-3">1</span>
                  {t('form.selectTicket')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeTicketTiers.map(tier => {
                      const isSelected = formData.ticketTierId === tier.id;
                      const isSoldOut = tier.sold >= tier.limit;
                      return (
                          <div 
                              key={tier.id}
                              onClick={() => !isSoldOut && handleTicketSelect(tier.id)}
                              className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                  isSelected 
                                  ? 'border-primary bg-primary/5 shadow-md' 
                                  : isSoldOut 
                                    ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-60 cursor-not-allowed'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:shadow-sm dark:bg-gray-800'
                              }`}
                          >
                              <div className="flex justify-between items-start mb-2">
                                  <h4 className={`font-bold text-lg ${isSelected ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>{tier.name}</h4>
                                  <div className="text-right">
                                      <span className={`block font-bold text-lg ${isSelected ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>
                                          {tier.price === 0 ? 'Free' : `${tier.currency} ${tier.price}`}
                                      </span>
                                  </div>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{tier.description}</p>
                              {tier.benefits.length > 0 && (
                                  <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-2">
                                      {tier.benefits.map((b, i) => (
                                          <li key={i} className="flex items-center">
                                              <svg className="w-3 h-3 mr-1.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                              {b}
                                          </li>
                                      ))}
                                  </ul>
                              )}
                              {isSoldOut && (
                                  <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center rounded-xl">
                                      <span className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider transform -rotate-12">{t('form.soldOut')}</span>
                                  </div>
                              )}
                              {isSelected && (
                                  <div className="absolute top-4 right-4 bg-primary text-white rounded-full p-1">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                  </div>
                              )}
                          </div>
                      );
                  })}
              </div>
              {errors.ticketTierId && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400 animate-fade-in-down">
                      {errors.ticketTierId}
                  </p>
              )}
          </div>
      )}

      {/* Account Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold mr-3">{activeTicketTiers.length > 0 ? 2 : 1}</span>
            {t('form.yourDetails')}
        </h3>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TextInput
              label={t('form.firstName')}
              name="firstName"
              value={formData.firstName}
              onChange={handleFormChangeInternal}
              onBlur={handleBlur}
              placeholder="e.g. Jane"
              required
              error={touched.firstName ? errors.firstName : ''}
            />
            <TextInput
              label={t('form.lastName')}
              name="lastName"
              value={formData.lastName}
              onChange={handleFormChangeInternal}
              onBlur={handleBlur}
              placeholder="e.g. Doe"
              required
              error={touched.lastName ? errors.lastName : ''}
            />
          </div>
           <TextInput
              label={t('form.email')}
              name="email"
              type="email"
              value={formData.email}
              onChange={handleFormChangeInternal}
              onBlur={handleBlur}
              placeholder="e.g. jane.doe@example.com"
              required
              error={touched.email ? errors.email : ''}
            />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <TextInput
                label={t('form.password')}
                name="password"
                type="password"
                value={formData.password || ''}
                onChange={handleFormChangeInternal}
                onBlur={handleBlur}
                placeholder="••••••••"
                required
                error={touched.password ? errors.password : ''}
              />
              <PasswordStrengthIndicator strength={passwordStrength} />
            </div>
            <TextInput
              label={t('form.confirmPassword')}
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              onBlur={handleBlur}
              placeholder="••••••••"
              required
              error={touched.confirmPassword ? errors.confirmPassword : ''}
            />
          </div>
        </div>
      </div>
      
      {/* Additional Info Section */}
      {enabledCustomFields.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
           <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold mr-3">{activeTicketTiers.length > 0 ? 3 : 2}</span>
                {t('form.additionalInfo')}
           </h3>
          <div className="space-y-6">
            {enabledCustomFields.map(field => (
              <DynamicFormField
                key={field.id}
                field={field}
                value={formData[field.id] || ''}
                onChange={onFormChange}
                onBlur={handleBlur}
                error={touched[field.id] ? errors[field.id] : ''}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-4 flex flex-col items-center gap-4">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full sm:w-2/3 flex justify-center items-center py-4 px-6 border border-transparent rounded-xl shadow-lg text-lg font-bold text-white bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70 disabled:cursor-not-allowed transform transition-all duration-200 hover:-translate-y-1"
        >
          {isLoading ? (
            <>
              <Spinner />
              <span className="ml-2">{t('form.processing')}</span>
            </>
          ) : (
            t('form.completeRegistration')
          )}
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={handleResetClick}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline transition-colors"
        >
          {t('form.clear')}
        </button>
      </div>
    </form>
  );
};
