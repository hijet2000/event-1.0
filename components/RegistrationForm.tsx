
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
  const [showConfirm, setShowConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const activeTicketTiers = ticketTiers.filter(t => t.active);

  useEffect(() => {
    if (formData.password) {
      setPasswordStrength(checkPasswordStrength(formData.password));
    }
  }, []);
  
  const handleFormChangeInternal = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'password') {
        setPasswordStrength(checkPasswordStrength(value));
        if (touched.confirmPassword && confirmPassword) {
             setErrors(prev => ({
                 ...prev,
                 confirmPassword: value !== confirmPassword ? 'Passwords do not match.' : ''
             }));
        }
    }
    
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
        return !value?.trim() ? `${t('form.firstName')} is required.` : '';
      case 'lastName':
        return !value?.trim() ? `${t('form.lastName')} is required.` : '';
      case 'email':
        if (!value?.trim()) return `${t('form.email')} is required.`;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address.';
        return '';
      case 'password':
        if (!value) return `${t('form.password')} is required.`;
        if (value.length < 8) return 'Password must be at least 8 characters long.';
        return '';
      case 'confirmPassword':
        return currentData.password !== currentConfirmPassword ? 'Passwords do not match.' : '';
      case 'ticketTierId':
        return activeTicketTiers.length > 0 && !value ? 'Please select a ticket option.' : '';
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
      setShowConfirm(true);
    }
  };

  const handleConfirmSubmit = () => {
      onSubmit();
  };

  const handleResetClick = () => {
    setErrors({});
    setTouched({});
    setConfirmPassword('');
    setPasswordStrength({ score: 0, label: '' });
    onReset();
  };
  
  const enabledCustomFields = config.filter(field => field.enabled);

  return (
    <>
        <form onSubmit={handleSubmit} className="space-y-12" ref={formRef} noValidate>
        
        {/* Step 1: Ticket Selection */}
        {activeTicketTiers.length > 0 && (
            <div id="ticket-section" className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 sm:p-12 shadow-sm border border-gray-100 dark:border-gray-700 transition-all hover:shadow-xl">
                <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-10 flex items-center uppercase tracking-tighter">
                    <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-white text-sm font-black mr-5 shadow-lg shadow-primary/30">01</span>
                    Select Pass
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {activeTicketTiers.map(tier => {
                        const isSelected = formData.ticketTierId === tier.id;
                        const isSoldOut = tier.sold >= tier.limit;
                        return (
                            <div 
                                key={tier.id}
                                onClick={() => !isSoldOut && handleTicketSelect(tier.id)}
                                className={`relative p-8 rounded-[2rem] border-4 transition-all cursor-pointer group ${
                                    isSelected 
                                    ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/10' 
                                    : isSoldOut 
                                        ? 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 opacity-40 cursor-not-allowed'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-primary/40 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <h4 className={`font-black text-2xl uppercase tracking-tighter ${isSelected ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>{tier.name}</h4>
                                    <div className="text-right">
                                        <span className={`block font-black text-2xl ${isSelected ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>
                                            {tier.price === 0 ? 'FREE' : `${tier.currency}${tier.price}`}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">{tier.description}</p>
                                {isSelected && (
                                    <div className="absolute -top-4 -right-4 bg-primary text-white rounded-2xl p-2 shadow-2xl border-4 border-white dark:border-gray-800 animate-bounce">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                )}
                                <div className={`h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden ${isSelected ? 'opacity-100' : 'opacity-30'}`}>
                                    <div className="h-full bg-primary" style={{ width: `${Math.min((tier.sold / tier.limit) * 100, 100)}%` }}></div>
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-2">Available Capacity: {tier.limit - tier.sold}</p>
                            </div>
                        );
                    })}
                </div>
                {errors.ticketTierId && (
                    <p className="mt-6 text-sm text-red-600 dark:text-red-400 font-black uppercase tracking-widest flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                        {errors.ticketTierId}
                    </p>
                )}
            </div>
        )}

        {/* Step 2: Personal Details */}
        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 sm:p-12 shadow-sm border border-gray-100 dark:border-gray-700 transition-all hover:shadow-xl">
            <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-10 flex items-center uppercase tracking-tighter">
                <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-white text-sm font-black mr-5 shadow-lg shadow-primary/30">{activeTicketTiers.length > 0 ? '02' : '01'}</span>
                Identity
            </h3>
            <div className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <TextInput
                        label="First Name"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleFormChangeInternal}
                        onBlur={handleBlur}
                        placeholder="Jane"
                        required
                        error={touched.firstName ? errors.firstName : ''}
                    />
                    <TextInput
                        label="Last Name"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleFormChangeInternal}
                        onBlur={handleBlur}
                        placeholder="Doe"
                        required
                        error={touched.lastName ? errors.lastName : ''}
                    />
                </div>
                <TextInput
                    label="Business Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleFormChangeInternal}
                    onBlur={handleBlur}
                    placeholder="jane.doe@organization.com"
                    required
                    error={touched.email ? errors.email : ''}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div>
                        <TextInput
                            label="Create Access Password"
                            name="password"
                            type="password"
                            value={formData.password || ''}
                            onChange={handleFormChangeInternal}
                            onBlur={handleBlur}
                            placeholder="Min 8 characters"
                            required
                            error={touched.password ? errors.password : ''}
                        />
                        <PasswordStrengthIndicator strength={passwordStrength} />
                    </div>
                    <TextInput
                        label="Verify Password"
                        name="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={handleConfirmPasswordChange}
                        onBlur={handleBlur}
                        placeholder="Repeat password"
                        required
                        error={touched.confirmPassword ? errors.confirmPassword : ''}
                    />
                </div>
            </div>
        </div>
        
        {/* Step 3: Custom Request Area */}
        <div className="bg-gradient-to-br from-primary/5 via-primary/[0.02] to-secondary/5 dark:from-indigo-950/20 dark:to-purple-950/20 rounded-[3rem] p-8 sm:p-14 shadow-inner border border-primary/10 dark:border-indigo-900/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none transform group-hover:rotate-12 duration-1000">
                 <svg className="w-64 h-64 text-primary" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/></svg>
            </div>
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
              <h3 className="text-3xl font-black text-gray-900 dark:text-white flex items-center uppercase tracking-tighter">
                  <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary text-white text-sm font-black mr-5 shadow-xl shadow-primary/30">✨</span>
                  AI Curator
              </h3>
              <span className="px-4 py-1.5 bg-white dark:bg-gray-800 rounded-full border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest shadow-sm">Bespoke Experience</span>
            </div>

            <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-10 max-w-2xl leading-relaxed">
                What are your main objectives? Describe your custom request, and our Gemini AI will construct a <span className="text-primary font-bold underline decoration-primary/30 decoration-4">Personalized Event Strategy</span> just for you.
            </p>
            
            <div className="space-y-10">
                <div className="relative">
                    <label htmlFor="goals" className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-3 ml-1">Your Narrative</label>
                    <textarea 
                        id="goals"
                        name="goals"
                        value={formData.goals || ''}
                        onChange={handleFormChangeInternal}
                        rows={5}
                        className="w-full rounded-[1.5rem] border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-6 text-base font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-inner placeholder:text-gray-400"
                        placeholder="I want to connect with Venture Capitalists interested in Carbon Capture technologies, and identify which technical deep-dives are most relevant to scaling LLMs..."
                    />
                    <div className="absolute bottom-4 right-6 text-[10px] font-bold text-gray-400 pointer-events-none flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                      Direct to AI Core
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {enabledCustomFields.map(field => (
                      <DynamicFormField
                          key={field.id}
                          field={field}
                          value={formData[field.id] || ''}
                          onChange={handleFormChangeInternal}
                          onBlur={handleBlur}
                          error={touched[field.id] ? errors[field.id] : ''}
                      />
                  ))}
                </div>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-10 flex flex-col items-center gap-8">
            <button
            type="submit"
            disabled={isLoading}
            className="group w-full sm:w-3/4 flex justify-center items-center py-6 px-10 border border-transparent rounded-full shadow-3xl text-2xl font-black text-white bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 focus:outline-none focus:ring-8 focus:ring-primary/10 disabled:opacity-70 disabled:cursor-not-allowed transform transition-all duration-500 hover:-translate-y-2"
            >
            {isLoading ? (
                <>
                <Spinner />
                <span className="ml-3 uppercase tracking-tighter">Initializing Passage...</span>
                </>
            ) : (
                <span className="flex items-center gap-3 uppercase tracking-tighter">
                  Complete Registration
                  <svg className="w-8 h-8 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                </span>
            )}
            </button>
            <button
            type="button"
            disabled={isLoading}
            onClick={handleResetClick}
            className="text-xs font-black text-gray-400 hover:text-primary dark:text-gray-500 dark:hover:text-primary uppercase tracking-[0.2em] transition-all border-b-2 border-transparent hover:border-primary/30 pb-1"
            >
            {t('form.clear')}
            </button>
        </div>
        </form>
        
        {/* Verification / Review Modal */}
        {showConfirm && (
          <div className="fixed inset-0 bg-gray-950/80 z-[100] flex items-center justify-center p-6 backdrop-blur-2xl animate-fade-in">
              <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-4xl w-full max-w-2xl overflow-hidden flex flex-col border border-white/10">
                  <div className="p-10 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50">
                      <h3 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Final Verification</h3>
                      <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mt-2 uppercase tracking-widest">Review your credentials</p>
                  </div>
                  
                  <div className="p-10 overflow-y-auto space-y-8">
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Attendee</span>
                            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{formData.firstName} {formData.lastName}</p>
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Terminal</span>
                            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 truncate">{formData.email}</p>
                        </div>
                      </div>
                      <div className="p-8 rounded-[2rem] bg-primary/5 border border-primary/10">
                          <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Besoke AI Request</span>
                          <p className="text-base text-gray-700 dark:text-gray-300 mt-4 leading-relaxed font-medium">"{formData.goals || 'Optimization of general attendance goals.'}"</p>
                      </div>
                  </div>

                  <div className="p-10 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-6 bg-gray-50/30 dark:bg-gray-950/30">
                      <button 
                          type="button" 
                          onClick={() => setShowConfirm(false)}
                          className="px-8 py-4 rounded-2xl text-sm font-black text-gray-500 uppercase tracking-widest hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                          Edit
                      </button>
                      <button 
                          type="button" 
                          onClick={handleConfirmSubmit}
                          disabled={isLoading}
                          className="px-10 py-4 bg-primary text-white rounded-2xl text-sm font-black shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest disabled:opacity-70"
                      >
                          {isLoading ? <Spinner /> : 'Commit Information'}
                      </button>
                  </div>
              </div>
          </div>
        )}
    </>
  );
};
