
import React, { useState, useEffect } from 'react';
import { type Role, type Permission, ALL_PERMISSIONS, PERMISSION_GROUPS } from '../types';
import { Spinner } from './Spinner';

interface RoleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<boolean>;
  role: Role | null;
}

export const RoleEditorModal: React.FC<RoleEditorModalProps> = ({ isOpen, onClose, onSave, role }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isNewRole = !role;

  useEffect(() => {
    if (isOpen) {
      setName(role?.name || '');
      setDescription(role?.description || '');
      setPermissions(new Set(role?.permissions || []));
      setError(null);
      setIsSaving(false);
    }
  }, [isOpen, role]);

  if (!isOpen) return null;

  const handlePermissionChange = (permission: Permission, checked: boolean) => {
    setPermissions(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(permission);
      } else {
        newSet.delete(permission);
      }
      return newSet;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
        setError("Role name is required.");
        return;
    }
    
    setIsSaving(true);
    setError(null);
    
    const data: any = {
      name,
      description,
      permissions: Array.from(permissions),
    };
    
    const success = await onSave(data);
    setIsSaving(false);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSave}>
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{isNewRole ? 'Add New Role' : 'Edit Role'}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{isNewRole ? 'Define a new role and its permissions.' : role?.name}</p>
          </div>
          
          <div className="p-6 space-y-6 border-t border-b border-gray-200 dark:border-gray-700 max-h-[70vh] overflow-y-auto">
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Role Name" id="name" type="text" value={name} onChange={e => setName(e.target.value)} required />
                <InputField label="Description" id="description" type="text" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            
            <div>
              <h3 className="text-md font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                  Module Permissions
              </h3>
              
              <div className="space-y-8">
                  {Object.entries(PERMISSION_GROUPS).map(([group, groupPermissions]) => (
                      <div key={group} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                          <h4 className="text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">{group}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {groupPermissions.map(key => (
                                  <div key={key} className="relative flex items-start p-2 rounded hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                    <div className="flex h-6 items-center">
                                      <input
                                        id={key}
                                        name={key}
                                        type="checkbox"
                                        checked={permissions.has(key as Permission)}
                                        onChange={(e) => handlePermissionChange(key as Permission, e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:bg-gray-700 dark:border-gray-600"
                                      />
                                    </div>
                                    <div className="ml-3 text-sm leading-6">
                                      <label htmlFor={key} className="font-bold text-gray-900 dark:text-white cursor-pointer">{key.replace(/_/g, ' ')}</label>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">{ALL_PERMISSIONS[key as Permission]}</p>
                                    </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 rounded-b-lg">
            <button type="button" onClick={onClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
            <button type="submit" disabled={isSaving} className="py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-primary hover:bg-primary/90 flex items-center justify-center disabled:opacity-50">
              {isSaving ? <><Spinner /> Saving...</> : 'Save Changes'}
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
