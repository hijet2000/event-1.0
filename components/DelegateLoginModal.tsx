import React, { useState } from 'react';
import { requestDelegatePasswordReset } from '../server/api';
import { Spinner } from './Spinner';

interface DelegateLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password_input: string) => Promise<boolean>;
}

export const DelegateLoginModal: React.FC<DelegateLoginModalProps> = ({ isOpen, onClose, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [view, setView] = useState<'login' | 'forgot' | 'forgot_sent'>('login');

  if (!isOpen) {
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
        const success = await onLogin(email, password);
        if (!success) {
            setError('Invalid email or password.');
        }
    } catch (err) {
        console.error("Login submission error:", err);
        setError('An unexpected error occurred. Please try again.');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
        await requestDelegatePasswordReset(email);
        setView('forgot_sent');
    } catch (err) {
        setError('An error occurred. Please try again.');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleClose = () => {
      setEmail('');
      setPassword('');
      setError('');
      setView('login');
      onClose();
  };

  const renderContent = () => {
    if (view === 'forgot_sent') {
      return (
        <div className="text-center">
          <h2 id="delegate-login-title" className="text-2xl font-bold text-gray-900 dark:text-white">
            Check Your Email
          </h2>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            If an account with the email <strong className="text-gray-800 dark:text-gray-200">{email}</strong> exists, you will receive password reset instructions.
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="mt-6 w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
          >
            Close
          </button>
        </div>
      );
    }

    if (view === 'forgot') {
      return (
        <>
          <div className="text-center">
            <h2 id="delegate-login-title" className="text-2xl font-bold text-gray-900 dark:text-white">
              Reset Password
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Enter your email to receive a reset link.
            </p>
          </div>
          <form onSubmit={handleRequestReset} className="mt-8 space-y-4">
            <div>
              <label htmlFor="delegate-email-reset" className="sr-only">Email</label>
              <input
                id="delegate-email-reset"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="Email"
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400 text-center" role="alert">{error}</p>}
            <div className="flex flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-primary/70"
              >
                {isSubmitting ? <><Spinner /> Sending Link...</> : 'Send Reset Link'}
              </button>
              <button
                type="button"
                onClick={() => setView('login')}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
              >
                Back to Login
              </button>
            </div>
          </form>
        </>
      );
    }

    return (
      <>
        <div className="text-center">
          <h2 id="delegate-login-title" className="text-2xl font-bold text-gray-900 dark:text-white">
            Delegate Portal
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Access your event details and wallet.
          </p>
        </div>
        
        <form onSubmit={handleLogin} className="mt-8 space-y-6">
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <input
                id="email" name="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-t-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                placeholder="Email Address" disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password" name="password" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-b-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                placeholder="Password" disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="text-sm text-center">
             <button type="button" onClick={() => setView('forgot')} className="font-medium text-primary hover:text-primary/80">
                Forgot your password?
             </button>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400 text-center" role="alert">{error}</p>}

          <div className="flex gap-4 pt-2">
            <button
              type="button" onClick={handleClose} disabled={isSubmitting}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/80 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={isSubmitting}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-primary/70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </>
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delegate-login-title"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-8"
        onClick={(e) => e.stopPropagation()} // Prevent closing modal on inner click
      >
        {renderContent()}
      </div>
    </div>
  );
};
