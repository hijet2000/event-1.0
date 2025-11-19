import React, { useState } from 'react';
import { sendDelegateInvitation } from '../server/api';
import { Spinner } from './Spinner';
import { Alert } from './Alert';

interface InviteDelegateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteSuccess: (email: string) => void;
  adminToken: string;
}

export const InviteDelegateModal: React.FC<InviteDelegateModalProps> = ({ isOpen, onClose, onInviteSuccess, adminToken }) => {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setEmail('');
    setIsSending(false);
    setError(null);
    onClose();
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
                    Enter the email address of the person you want to invite. They will receive an email with a unique registration link.
                </p>
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