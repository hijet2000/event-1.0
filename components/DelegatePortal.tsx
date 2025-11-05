
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { type RegistrationData, type EventConfig, type Transaction, type Invitation } from '../types';
import { getDelegateProfile, getTransactionsForUser, getOtherDelegates, sendEventCoin, createInvitation, getSentInvitations } from '../server/api';
import { ContentLoader } from './ContentLoader';
import { Alert } from './Alert';
import { Spinner } from './Spinner';
import { ProfileView } from './ProfileView';

interface DelegatePortalProps {
  onLogout: () => void;
  delegateToken: string;
}

type DelegateView = 'dashboard' | 'send' | 'invite' | 'profile';

// --- Sub-Views (Extracted for better organization) ---

const Loader: React.FC = () => (
    <div className="flex justify-center items-center">
        <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

interface QRCodeScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (data: string) => void;
}

const QRCodeScannerModal: React.FC<QRCodeScannerModalProps> = ({ isOpen, onClose, onScan }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const cleanup = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    useEffect(() => {
        if (!isOpen) {
            cleanup();
            return;
        }
        
        const startScan = async () => {
            setError(null);
            setIsLoading(true);

            if (!('BarcodeDetector' in window)) {
                setError('QR code scanning is not supported by your browser.');
                setIsLoading(false);
                return;
            }

            try {
                streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                if (videoRef.current) {
                    videoRef.current.srcObject = streamRef.current;
                    await videoRef.current.play();
                    setIsLoading(false);
                    
                    const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
                    
                    const detect = () => {
                        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
                           return;
                        }
                        if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                             barcodeDetector.detect(videoRef.current)
                                .then((barcodes: any[]) => {
                                    if (barcodes.length > 0) {
                                        onScan(barcodes[0].rawValue);
                                    } else {
                                        animationFrameRef.current = requestAnimationFrame(detect);
                                    }
                                })
                                .catch((err: Error) => {
                                    console.error("Barcode detection failed:", err);
                                });
                        } else {
                            animationFrameRef.current = requestAnimationFrame(detect);
                        }
                    };
                    detect();
                }
            } catch (err) {
                 if (err instanceof Error) {
                    if (err.name === 'NotAllowedError') {
                        setError('Camera permission denied. Please enable camera access in your browser settings.');
                    } else if (err.name === 'NotFoundError') {
                         setError('No camera found. Please connect a camera to use this feature.');
                    } else {
                        setError(`Could not start camera: ${err.message}`);
                    }
                } else {
                    setError('An unknown error occurred while accessing the camera.');
                }
                setIsLoading(false);
            }
        };

        startScan();

        return () => {
            cleanup();
        };

    }, [isOpen, onScan, cleanup]);


    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-scanner-title"
        >
            <div 
                className="bg-gray-900 rounded-lg shadow-xl w-full max-w-lg h-full max-h-[80vh] flex flex-col relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h2 id="qr-scanner-title" className="text-lg font-bold text-white">Scan Recipient's QR Code</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
                </div>
                <div className="flex-1 relative bg-black flex items-center justify-center">
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline />
                    <div className="absolute inset-0 flex items-center justify-center">
                        {isLoading && <Loader />}
                        {error && <div className="p-4 max-w-sm mx-auto"><Alert type="error" message={error} /></div>}
                        {!isLoading && !error && <div className="absolute w-2/3 aspect-square border-4 border-dashed border-white/50 rounded-lg"></div>}
                    </div>
                </div>
                 <div className="p-4 text-center text-sm text-gray-400 bg-gray-800 flex-shrink-0">
                    Position the delegate's QR code inside the frame.
                </div>
            </div>
        </div>
    );
};

const DashboardView: React.FC<{
    user: RegistrationData;
    config: EventConfig;
    balance: number;
    transactions: Transaction[];
}> = ({ user, config, balance, transactions }) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
            <div className="bg-gradient-to-br from-primary/80 to-primary dark:from-primary/70 dark:to-primary/90 text-white shadow-lg rounded-2xl p-6 flex flex-col justify-between h-full">
                <div>
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold opacity-90">Your Wallet</h2>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    </div>
                    <p className="text-sm opacity-70">{config.eventCoin.name}</p>
                </div>
                <div className="text-right mt-8">
                    <p className="text-5xl font-bold tracking-tight">{balance.toLocaleString()}</p>
                     {config.eventCoin.peggedCurrency && <p className="text-sm opacity-80 mt-1">~${(balance * config.eventCoin.exchangeRate).toFixed(2)} {config.eventCoin.peggedCurrency}</p>}
                </div>
            </div>
             <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Recent Activity</h3>
                <div className="bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-4 space-y-3">
                    {transactions.length > 0 ? (
                        transactions.slice(0, 3).map(tx => (
                            <div key={tx.id} className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {tx.fromEmail === user.email ? `To: ${tx.toName}` : `From: ${tx.fromName}`}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{tx.message || 'Peer Transfer'}</p>
                                </div>
                                <p className={`text-lg font-mono font-semibold ${tx.toEmail === user.email ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {tx.toEmail === user.email ? '+' : '-'}{tx.amount.toLocaleString()}
                                </p>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-4">No transactions yet.</p>
                    )}
                </div>
            </div>
        </div>
        <div className="lg:col-span-2">
             <div className="w-full max-w-sm mx-auto aspect-[1/1.618] rounded-xl shadow-lg relative overflow-hidden bg-white dark:bg-gray-700">
                {config.theme.badgeImageUrl ? <img src={config.theme.badgeImageUrl} alt="Badge BG" className="absolute inset-0 w-full h-full object-cover z-0" /> : <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 z-0"></div>}
                <div className="absolute inset-0 bg-black/20 z-10"></div>
                <div className="absolute inset-0 z-20 p-6 flex flex-col justify-between text-white text-shadow">
                     <header className="flex items-center gap-4">
                        {config.theme.logoUrl && <img src={config.theme.logoUrl} alt="Logo" className="h-12 w-12 rounded-full object-contain bg-white/80 p-1" />}
                        <h3 className="font-bold text-lg tracking-tight">{config.event.name}</h3>
                    </header>
                    <div className="text-center">
                        {config.badgeConfig.showName && <h1 className="text-3xl font-bold uppercase tracking-wider" style={{ color: config.theme.colorPrimary }}>{user.name}</h1>}
                        {config.badgeConfig.showCompany && user.company && <p className="text-lg font-medium">{user.company}</p>}
                        {config.badgeConfig.showRole && user.role && <p className="text-md text-gray-200">{user.role}</p>}
                    </div>
                    <footer className="flex items-end justify-between">
                        <p className="text-xs text-gray-300">&copy; {new Date().getFullYear()}</p>
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${user.email}&bgcolor=ffffff`} alt="QR Code" className="w-20 h-20 rounded-lg bg-white p-1" />
                    </footer>
                </div>
            </div>
        </div>
    </div>
);

const SendCoinView: React.FC<{
    delegates: { name: string; email: string }[];
    onSend: (toEmail: string, amount: number, message: string) => Promise<boolean>;
    currencyName: string;
    balance: number;
    userEmail: string;
}> = ({ delegates, onSend, currencyName, balance, userEmail }) => {
    const [toEmail, setToEmail] = useState('');
    const [amount, setAmount] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const otherDelegates = useMemo(() => delegates.filter(d => d.email !== userEmail), [delegates, userEmail]);

    const handleScan = (data: string) => {
        setIsScannerOpen(false);
        const recipientExists = otherDelegates.some(d => d.email === data);
        if (recipientExists) {
            setToEmail(data);
            setSuccess(`Recipient ${data} selected successfully.`);
            setTimeout(() => setSuccess(''), 3000);
        } else {
            setError(`The scanned user (${data}) is not a valid recipient.`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!toEmail || !amount || parseFloat(amount) <= 0) {
            setError('Recipient and a positive amount are required.');
            return;
        }
        setIsSending(true);
        try {
            const sent = await onSend(toEmail, parseFloat(amount), message);
            if(sent) {
                setSuccess(`Successfully sent ${amount} ${currencyName} to ${toEmail}.`);
                setToEmail('');
                setAmount('');
                setMessage('');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send.');
        } finally {
            setIsSending(false);
        }
    };
    
    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
                {error && <Alert type="error" message={error} />}
                {success && <Alert type="success" message={success} />}
                <p className="text-sm text-gray-500 dark:text-gray-400">Your current balance: <span className="font-bold text-primary">{balance.toLocaleString()} {currencyName}</span></p>
                <div>
                    <label htmlFor="recipient" className="block text-sm font-medium">Recipient</label>
                    <div className="flex items-center gap-2 mt-1">
                        <select id="recipient" value={toEmail} onChange={e => setToEmail(e.target.value)} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" required>
                            <option value="">Select a delegate...</option>
                            {otherDelegates.map(d => <option key={d.email} value={d.email}>{d.name} ({d.email})</option>)}
                        </select>
                         <button
                            type="button"
                            onClick={() => setIsScannerOpen(true)}
                            className="p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 flex-shrink-0"
                            aria-label="Scan QR code to add recipient"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6.5 6.5l-1.5-1.5M4 12H2m13.5-6.5l-1.5 1.5M4 20h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </button>
                    </div>
                </div>
                <div>
                     <label htmlFor="amount" className="block text-sm font-medium">Amount ({currencyName})</label>
                     <input type="number" id="amount" value={amount} onChange={e => setAmount(e.target.value)} step="0.01" min="0.01" max={balance} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" required />
                </div>
                 <div>
                     <label htmlFor="message" className="block text-sm font-medium">Message (Optional)</label>
                     <textarea id="message" value={message} onChange={e => setMessage(e.target.value)} rows={3} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" placeholder="For coffee, lunch, etc."></textarea>
                </div>
                <div className="flex justify-end gap-4">
                    <button type="submit" disabled={isSending} className="py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center disabled:opacity-50">
                       {isSending && <Spinner />} {isSending ? 'Sending...' : `Send ${currencyName}`}
                    </button>
                </div>
            </form>
            <QRCodeScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleScan}
            />
        </>
    );
};

const InviteView: React.FC<{
    onInvite: (email: string) => Promise<string | null>;
    sentInvitations: Invitation[];
    isLoading: boolean;
}> = ({ onInvite, sentInvitations, isLoading }) => {
    const [inviteeEmail, setInviteeEmail] = useState('');
    const [error, setError] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [lastInviteLink, setLastInviteLink] = useState('');
    const [copyButtonText, setCopyButtonText] = useState('Copy');

    const handleCopyLink = () => {
        navigator.clipboard.writeText(lastInviteLink).then(() => {
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy'), 2000);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLastInviteLink('');
        if (!inviteeEmail || !/\S+@\S+\.\S+/.test(inviteeEmail)) {
            setError('Please enter a valid email address.');
            return;
        }
        setIsSending(true);
        try {
            const link = await onInvite(inviteeEmail);
            if (link) {
                setLastInviteLink(link);
                setInviteeEmail('');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send invitation.');
        } finally {
            setIsSending(false);
        }
    };
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                 <form onSubmit={handleSubmit} className="space-y-6">
                    {error && <Alert type="error" message={error} />}
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Know someone who should be at this event? Send them an invitation. An email will be sent and you can also copy the direct link below.
                    </p>
                    <div>
                        <label htmlFor="inviteeEmail" className="block text-sm font-medium">Invitee's Email Address</label>
                        <input type="email" id="inviteeEmail" value={inviteeEmail} onChange={e => setInviteeEmail(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" required />
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" disabled={isSending} className="py-2 px-5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 flex items-center disabled:opacity-50">
                            {isSending && <Spinner />} {isSending ? 'Sending...' : 'Send Invitation'}
                        </button>
                    </div>
                </form>
                {lastInviteLink && (
                    <div className="mt-6 p-4 rounded-md bg-gray-100 dark:bg-gray-900/50 animate-fade-in">
                        <label className="block text-sm font-medium mb-1">Invitation Link:</label>
                        <div className="flex gap-2">
                           <input type="text" readOnly value={lastInviteLink} className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm sm:text-sm" />
                           <button onClick={handleCopyLink} className="py-2 px-4 border rounded-md text-sm font-medium">{copyButtonText}</button>
                        </div>
                    </div>
                )}
            </div>
            <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Your Sent Invitations</h3>
                {isLoading ? <ContentLoader /> : sentInvitations.length > 0 ? (
                    <ul className="mt-4 space-y-3 max-h-80 overflow-y-auto pr-2">
                        {sentInvitations.map(inv => (
                            <li key={inv.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md flex justify-between items-center">
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-gray-100">{inv.inviteeEmail}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Sent: {new Date(inv.createdAt).toLocaleString()}</p>
                                </div>
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    inv.status === 'accepted' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                }`}>
                                    {inv.status}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 italic">You haven't sent any invitations yet.</p>
                )}
            </div>
        </div>
    );
};

const NavItem: React.FC<{ active: boolean; onClick: () => void; label: string; icon: React.ReactNode; }> = ({ active, onClick, label, icon }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors duration-200 ${active ? 'bg-primary text-white font-semibold shadow-md' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
    >
        {icon}
        <span>{label}</span>
    </button>
);


// --- Main Component ---
export const DelegatePortal: React.FC<DelegatePortalProps> = ({ onLogout, delegateToken }) => {
    const [activeView, setActiveView] = useState<DelegateView>('dashboard');
    const [profile, setProfile] = useState<{ user: RegistrationData, config: EventConfig } | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [delegates, setDelegates] = useState<{ name: string; email: string }[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const loadData = useCallback(async (showLoading = true) => {
        if(showLoading) setIsLoading(true);
        try {
            const [profileData, transactionsData, delegatesData, invitationsData] = await Promise.all([
                getDelegateProfile(delegateToken),
                getTransactionsForUser(delegateToken),
                getOtherDelegates(delegateToken),
                getSentInvitations(delegateToken),
            ]);
            setProfile(profileData);
            setTransactions(transactionsData);
            setDelegates(delegatesData);
            setInvitations(invitationsData);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load delegate data.");
            if (err instanceof Error && err.message.includes("Authentication failed")) {
                onLogout();
            }
        } finally {
            if(showLoading) setIsLoading(false);
        }
    }, [delegateToken, onLogout]);

    useEffect(() => {
        loadData();
    }, [loadData]);
    
    const balance = useMemo(() => {
        if (!profile) return 0;
        return transactions.reduce((acc, tx) => {
            if (tx.toEmail === profile.user.email) return acc + tx.amount;
            if (tx.fromEmail === profile.user.email) return acc - tx.amount;
            return acc;
        }, 0);
    }, [transactions, profile]);

    const handleSendCoin = async (toEmail: string, amount: number, message: string): Promise<boolean> => {
        await sendEventCoin(delegateToken, toEmail, amount, message);
        await loadData(false); // Refresh data without full loading spinner
        return true;
    };
    
    const handleInvite = async (email: string): Promise<string | null> => {
        const { inviteLink } = await createInvitation(delegateToken, email);
        const invitationsData = await getSentInvitations(delegateToken);
        setInvitations(invitationsData);
        return inviteLink;
    };

    const handleProfileUpdate = (updatedUser: RegistrationData) => {
        setProfile(prev => prev ? { ...prev, user: updatedUser } : null);
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center"><ContentLoader text="Loading your portal..." /></div>;
    }

    if (error || !profile) {
        return <div className="min-h-screen flex items-center justify-center p-4"><Alert type="error" message={error || "Could not load profile."} /></div>;
    }
    
    const { user, config } = profile;

    const changeView = (view: DelegateView) => {
        setActiveView(view);
        setIsSidebarOpen(false);
    };

    const views: Record<DelegateView, { title: string; component: React.ReactNode }> = {
        dashboard: {
            title: 'Dashboard',
            component: <DashboardView user={user} config={config} balance={balance} transactions={transactions} />
        },
        send: {
            title: `Send ${config.eventCoin.name}`,
            component: <SendCoinView delegates={delegates} onSend={handleSendCoin} currencyName={config.eventCoin.name} balance={balance} userEmail={user.email} />
        },
        invite: {
            title: 'Invite Delegate',
            component: <InviteView onInvite={handleInvite} sentInvitations={invitations} isLoading={isLoading} />
        },
        profile: {
            title: 'Your Profile',
            component: <ProfileView user={user} delegateToken={delegateToken} onProfileUpdate={handleProfileUpdate} />
        }
    };

    const currentViewData = views[activeView];
    
    return (
       <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
            {isSidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
            
            <aside className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 z-30 w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col transition-transform duration-200 ease-in-out`}>
                 <div className="p-4 border-b dark:border-gray-700 flex flex-col items-center space-y-2">
                    {config.theme.logoUrl ? (
                        <img src={config.theme.logoUrl} alt="Event Logo" className="h-16 w-auto max-h-20 object-contain" />
                    ) : (
                        <svg className="h-12 w-12" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M50 0L93.3 25V75L50 100L6.7 75V25L50 0Z" stroke={config.theme.colorPrimary} strokeWidth="8"/>
                            <path d="M50 22L76.5 37V63L50 78L23.5 63V37L50 22Z" fill={config.theme.colorPrimary} />
                        </svg>
                    )}
                    <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200 text-center truncate w-full pt-2">{config.event.name}</h1>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <NavItem active={activeView === 'dashboard'} onClick={() => changeView('dashboard')} label="Dashboard" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>} />
                    <NavItem active={activeView === 'send'} onClick={() => changeView('send')} label={`Send ${config.eventCoin.name}`} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>} />
                    <NavItem active={activeView === 'invite'} onClick={() => changeView('invite')} label="Invite Delegate" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>} />
                    <NavItem active={activeView === 'profile'} onClick={() => changeView('profile')} label="Profile" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} />
                </nav>
                <div className="p-4 border-t dark:border-gray-700">
                    <button onClick={onLogout} className="w-full text-left flex items-center space-x-3 px-4 py-3 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
            
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700 md:justify-end">
                     <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-gray-500 focus:outline-none">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <div className="text-sm text-right">
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-gray-500">{user.email}</p>
                    </div>
                </header>
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 md:p-8">
                     <div className="bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-6 md:p-8">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{currentViewData.title}</h2>
                        {currentViewData.component}
                    </div>
                </main>
            </div>
        </div>
    );
};
