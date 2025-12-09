
import React, { useState, useEffect } from 'react';
import { type RegistrationData } from '../types';
import { updateDelegateProfile, cancelRegistration } from '../server/api';
import { Spinner } from './Spinner';
import { Alert } from './Alert';
import { TextInput } from './TextInput';
import { ImageUpload } from './ImageUpload';

interface ProfileViewProps {
  user: RegistrationData;
  delegateToken: string;
  onProfileUpdate: (updatedUser: RegistrationData) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, delegateToken, onProfileUpdate }) => {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    role: '',
    photoUrl: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      name: user.name || '',
      company: user.company || '',
      role: user.role || '',
      photoUrl: user.photoUrl || ''
    });
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (url: string) => {
      setFormData(prev => ({ ...prev, photoUrl: url }));
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

  const handleCancelRegistration = async () => {
      if (!window.confirm("Are you sure you want to cancel your registration? This action cannot be undone immediately.")) return;
      
      setIsCancelling(true);
      setError(null);
      
      try {
          // Pass the user's ID
          await cancelRegistration(delegateToken, user.id!);
          setSuccess("Registration cancelled successfully.");
          // Ideally, force logout or redirect, but for now we just show message
          setTimeout(() => {
              window.location.reload();
          }, 2000);
      } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to cancel registration.");
      } finally {
          setIsCancelling(false);
      }
  };

  return (
    <div className="max-w-lg space-y-8">
        <form onSubmit={handleSubmit} className="space-y-6">
        {error && <Alert type="error" message={error} />}
        {success && <Alert type="success" message={success} />}
        
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Profile Photo</label>
            <div className="flex justify-center">
                <div className="w-32">
                    <ImageUpload label="" value={formData.photoUrl} onChange={handlePhotoChange} />
                </div>
            </div>
            <p className="text-xs text-center text-gray-500 mt-2">Visible to other attendees in the Networking Hub</p>
        </div>

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
            className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-100 dark:bg-gray-700/50 sm:text-sm cursor-not-allowed text-gray-500"
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
        
        <div className="flex justify-end pt-4">
            <button
            type="submit"
            disabled={isSaving || isCancelling}
            className="py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center disabled:opacity-50 transition-all"
            >
            {isSaving && <Spinner />}
            <span className={isSaving ? 'ml-2' : ''}>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
        </div>
        </form>

        <div className="border-t pt-6 border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-red-600 mb-2">Danger Zone</h3>
            <p className="text-sm text-gray-500 mb-4">Once you cancel your registration, you will lose access to the event and your spot may be given to someone on the waitlist.</p>
            <button
                type="button"
                onClick={handleCancelRegistration}
                disabled={isCancelling}
                className="py-2 px-4 border border-red-300 text-red-700 rounded-md text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
                {isCancelling ? <Spinner /> : null}
                Cancel Registration
            </button>
        </div>
    </div>
  );
};
