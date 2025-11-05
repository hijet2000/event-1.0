
import React, { useState, useEffect } from 'react';
import { type RegistrationData } from '../types';
import { updateDelegateProfile } from '../server/api';
import { Spinner } from './Spinner';
import { Alert } from './Alert';
import { TextInput } from './TextInput';

interface ProfileViewProps {
  user: RegistrationData;
  delegateToken: string;
  onProfileUpdate: (updatedUser: RegistrationData) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, delegateToken, onProfileUpdate }) => {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    role: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      name: user.name || '',
      company: user.company || '',
      role: user.role || ''
    });
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    
    try {
      const updatedUser = await updateDelegateProfile(delegateToken, formData);
      onProfileUpdate(updatedUser);
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}
      
      <TextInput
        label="Full Name"
        name="name"
        value={formData.name}
        onChange={handleChange}
        required
      />
      
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          value={user.email}
          readOnly
          disabled
          className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-100 dark:bg-gray-700/50 sm:text-sm cursor-not-allowed"
        />
      </div>

      <TextInput
        label="Company"
        name="company"
        value={formData.company}
        onChange={handleChange}
      />
      
      <TextInput
        label="Role"
        name="role"
        value={formData.role}
        onChange={handleChange}
      />
      
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center disabled:opacity-50"
        >
          {isSaving && <Spinner />}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};
