import React, { useState, useEffect } from 'react';
import { sendDelegateInvitation } from '../server/api';
import { Spinner } from './Spinner';
import { Alert } from './Alert';
import { isNative, pickContact } from '../services/native';

interface InviteDelegateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSuccess: (email: string) => void;
  adminToken: string;
}

export const InviteDelegateModal: React.FC<InviteDelegateModalProps> = ({ isOpen, onClose, onInviteSuccess, adminToken }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
      setIsMobile(isNative());
  }, []);

  const handleClose = () => {
    setEmail('');
    setName('');
    setIsSending(false);
    setError(null);
    onClose();
  };
  
  const handlePickContact = async () => {
      const contact = await pickContact();
      if (contact) {
          if (contact.email) setEmail(contact.email);
          if (contact.name) setName(contact.name);
      }
  };
  
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      await sendDelegateInvitation(adminToken, 'main-event', email);
      onInviteSuccess(email);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSend}>
            <div className="p-6">
                <h2 id="invite-title" className="text-xl font-bold text-gray-900 dark:text-white">Invite Delegate</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Enter the email address of the person you want to invite.
                </p>
                
                {isMobile && (
                    <button 
                        type="button"
                        onClick={handlePickContact}
                        className="mt-4 w-full py-2 flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.274-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.274.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        Pick from Contacts
                    </button>
                )}

                <div className="mt-4">
                    <label htmlFor="invite-email" className="sr-only">Email Address</label>
                    <input
                        type="email"
                        id="invite-email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="delegate@example.com"
                        required
                    />
                </div>
                {error && <div className="mt-2"><Alert type="error" message={error} /></div>}
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
                <button type="button" onClick={handleClose} className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSending}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center justify-center disabled:opacity-50 w-36"
                >
                    {isSending ? <><Spinner /> Sending...</> : 'Send Invitation'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};