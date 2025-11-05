import React, { useState } from 'react';
import { resetPassword } from '../server/api';
import { Spinner } from './Spinner';
import { Alert } from './Alert';
import { Logo } from './Logo';
import { TextInput } from './TextInput';
import { useTheme } from '../contexts/ThemeContext';
import { checkPasswordStrength, type PasswordStrengthResult } from '../utils/passwordStrength';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';

interface PasswordResetFormProps {
  token: string;
}

export const PasswordResetForm: React.FC<PasswordResetFormProps> = ({ token }) => {
    const { config } = useTheme();
    const [password, setPassword] = useState('');
    const [passwordStrength, setPasswordStrength] = useState<PasswordStrengthResult>({ score: 0, label: '' });
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<{ type: 'error' | 'success', message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPassword = e.target.value;
        setPassword(newPassword);
        setPasswordStrength(checkPasswordStrength(newPassword));
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!password) {
            newErrors.password = 'New Password is required.';
        } else if (password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters long.';
        }
        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match.';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);
        if (!validate()) return;
        
        setIsSubmitting(true);
        try {
            await resetPassword(token, password);
            setStatus({ type: 'success', message: 'Your password has been successfully reset. You can now log in with your new password.' });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
            setStatus({ type: 'error', message: `Failed to reset password: ${message}`});
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const returnToHome = () => {
        window.location.href = '/';
    };
    
    if (status?.type === 'success') {
        return (
            <div className="text-center">
                <Logo />
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">Password Reset Successful</h1>
                <div className="mt-6 max-w-md mx-auto">
                    <Alert type="success" message={status.message} />
                </div>
                <button 
                    onClick={returnToHome} 
                    className="mt-6 w-full sm:w-auto inline-flex justify-center items-center py-3 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
                >
                    Return to Main Page
                </button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <header className="text-center">
                <Logo />
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                    Set a New Password
                </h1>
                <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                    Please enter and confirm your new password below.
                </p>
            </header>

            <form onSubmit={handleSubmit} className="mt-10 space-y-6 max-w-lg mx-auto">
                {status?.type === 'error' && <Alert type="error" message={status.message} />}

                <div>
                    <TextInput
                        label="New Password"
                        name="password"
                        type="password"
                        value={password}
                        onChange={handlePasswordChange}
                        placeholder="••••••••"
                        required
                        error={errors.password}
                    />
                    <PasswordStrengthIndicator strength={passwordStrength} />
                </div>
                 <TextInput
                    label="Confirm New Password"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    error={errors.confirmPassword}
                />

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-primary/70 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? <><Spinner /> Resetting Password...</> : 'Reset Password'}
                </button>
            </form>
        </div>
    );
};
