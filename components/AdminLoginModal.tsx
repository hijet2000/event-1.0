
import React, { useState, useRef, useEffect } from 'react';
import { loginAdmin, requestAdminPasswordReset } from '../server/api';
import { Spinner } from './Spinner';
import { type Permission } from '../types';

interface LoggedInUser {
    id: string;
    email: string;
    permissions: Permission[];
}

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string, user: LoggedInUser) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [view, setView] = useState<'login' | 'forgot' | 'forgot_sent'>('login');
  
  // Ref to track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(false);

  useEffect(() => {
      isMounted.current = true;
      return () => { isMounted.current = false; };
  }, []);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
        const result = await loginAdmin(email, password);
        
        // Check if component is still mounted before updating state or calling callbacks
        if (!isMounted.current) return;

        if (result) {
          localStorage.setItem('adminToken', result.token);
          onLoginSuccess(result.token, result.user);
        } else {
          setError('Incorrect email or password.');
          setIsSubmitting(false);
        }
    } catch (err) {
        console.error("Login Error Details:", err);
        if (isMounted.current) {
            setError('An error occurred during login. Check console for details.');
            setIsSubmitting(false);
        }
    }
  };
  
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
        await requestAdminPasswordReset(email);
        if (isMounted.current) {
             setView('forgot_sent');
             setIsSubmitting(false);
        }
    } catch (err) {
        if (isMounted.current) {
            setError('An error occurred. Please try again.');
            setIsSubmitting(false);
        }
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
          <h2 id="admin-login-title" className="text-2xl font-bold text-gray-900 dark:text-white">
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
            <h2 id="admin-login-title" className="text-2xl font-bold text-gray-900 dark:text-white">
              Reset Password
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Enter your email to receive a reset link.
            </p>
          </div>
          <form onSubmit={handleRequestReset} className="mt-8 space-y-4">
            <div>
              <label htmlFor="admin-email" className="sr-only">Email</label>
              <input
                id="admin-email"
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
          <h2 id="admin-login-title" className="text-2xl font-bold text-gray-900 dark:text-white">
            Admin Access
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Enter your credentials to continue.
          </p>
        </div>
        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <div>
            <label htmlFor="admin-email" className="sr-only">Email</label>
            <input
              id="admin-email"
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
          <div>
            <label htmlFor="admin-password" className="sr-only">Password</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              placeholder="Password"
            />
          </div>
          <div className="text-sm text-center">
             <button type="button" onClick={() => setView('forgot')} className="font-medium text-primary hover:text-primary/80">
                Forgot your password?
             </button>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400 text-center" role="alert">{error}</p>}
          <div className="flex flex-col gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-primary/70"
            >
              {isSubmitting ? <><Spinner />Authenticating...</> : 'Login'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
            >
              Cancel
            </button>
          </div>
        </form>
      </>
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-[1000] flex items-center justify-center p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-login-title"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-8 z-[1001] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {renderContent()}
      </div>
    </div>
  );
};
