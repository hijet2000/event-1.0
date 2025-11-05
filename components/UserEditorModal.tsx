

import React, { useState, useEffect } from 'react';
import { type AdminUser, type Role } from '../types';
import { Spinner } from './Spinner';

interface UserEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<boolean>;
  user: AdminUser | null;
  roles: Role[];
}

export const UserEditorModal: React.FC<UserEditorModalProps> = ({ isOpen, onClose, onSave, user, roles }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isNewUser = !user;

  useEffect(() => {
    if (isOpen) {
      setEmail(user?.email || '');
      setPassword(''); // Always clear password for security
      setRoleId(user?.roleId || (roles.length > 0 ? roles[0].id : ''));
      setError(null);
      setIsSaving(false);
    }
  }, [isOpen, user, roles]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !roleId) {
        setError("Email and Role are required.");
        return;
    }
    if (isNewUser && !password) {
        setError("Password is required for new users.");
        return;
    }
    
    setIsSaving(true);
    setError(null);
    
    const data: any = {
      email,
      roleId,
    };
    
    if (password) {
      data.password_hash = password; // API expects plain password, will hash on server
    }
    
    const success = await onSave(data);
    setIsSaving(false);
    if (success) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-editor-title"
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSave}>
          <div className="p-6">
            <h2 id="user-editor-title" className="text-xl font-bold text-gray-900 dark:text-white">{isNewUser ? 'Add New User' : 'Edit User'}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{isNewUser ? 'Create a new admin account.' : user?.email}</p>
          </div>
          
          <div className="p-6 space-y-4 border-t border-b border-gray-200 dark:border-gray-700">
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            
            <InputField label="Email Address" id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <InputField label="Password" id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isNewUser ? "Required" : "Leave blank to keep current"} required={isNewUser} />
            
            <div>
              <label htmlFor="roleId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
              <select id="roleId" value={roleId} onChange={e => setRoleId(e.target.value)} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                {roles.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
            <button type="submit" disabled={isSaving} className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center justify-center disabled:opacity-50">
              {isSaving ? <><Spinner /> Saving...</> : 'Save User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const InputField = (props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
    <div>
        <label htmlFor={props.id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{props.label}</label>
        <input {...props} className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
    </div>
);
