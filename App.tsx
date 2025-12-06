
import React, { useState, useEffect, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { type RegistrationData, type Permission, type Session, type Speaker, type Sponsor, type TicketTier } from './types';
import { registerUser, loginDelegate, triggerRegistrationEmails, getInvitationDetails, getPublicEventData, initializeApi, recordTicketSale } from './server/api';
import { verifyToken } from './server/auth';
import { RegistrationForm } from './components/RegistrationForm';
import { Alert } from './components/Alert';
import { Logo } from './components/Logo';
import { ContentLoader } from './components/ContentLoader';
import { AdminLoginModal } from './components/AdminLoginModal';
import { PasswordResetForm } from './components/PasswordResetForm';
import { DelegateLoginModal } from './components/DelegateLoginModal';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { EventSelectionPage } from './components/EventSelectionPage';
import { CountdownTimer } from './components/CountdownTimer';
import { AgendaView } from './components/AgendaView';
import { DirectoryView } from './components/DirectoryView';
import { PublicHome } from './components/PublicHome';
import { AccessibilityTools } from './components/AccessibilityTools';
import { PaymentModal } from './components/PaymentModal';
import { KioskView } from './components/KioskView';

// Lazy load heavy portals to improve initial page load speed
const AdminPortal = React.lazy(() => import('./components/AdminPortal').then(module => ({ default: module.AdminPortal })));
const DelegatePortal = React.lazy(() => import('./components/DelegatePortal').then(module => ({ default: module.DelegatePortal })));

type View = 'registration' | 'success' | 'passwordReset';
type PublicTab = 'home' | 'agenda' | 'speakers' | 'register';

interface AdminSession {
  token: string;
  user: { email: string; permissions: Permission[] };
}

export interface RegistrationFormState {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  ticketTierId?: string;
  [key: string]: any;
}

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  declare props: Readonly<ErrorBoundaryProps>;

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-lg w-full">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">The application encountered an unexpected error.</p>
            <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-auto text-sm font-mono text-red-500 mb-6 max-h-40">
              {this.state.error?.message || "Unknown error"}
            </div>
            <button 
              onClick={() => { localStorage.clear(); window.location.href = '/'; }}
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Clear Cache & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface EventPageContentProps {
  onAdminLogin: (token: string, user: { id: string; email: string; permissions: Permission[]; }) => void;
  eventId: string;
  onNavigate: (path: string) => void;
}

const EventPageContent: React.FC<EventPageContentProps> = ({ onAdminLogin, eventId, onNavigate }) => {
  const { config, registrationCount, isLoading: isThemeLoading, error: themeError } = useTheme();
  
  // Public Data State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);
  const [publicDataLoading, setPublicDataLoading] = useState(true);

  // Navigation State
  const [publicTab, setPublicTab] = useState<PublicTab>('home');

  const [view, setView] = useState<View>('registration');
  const [error, setError] = useState<string>('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const [isAdminModalOpen, setAdminModalOpen] = useState(false);
  const [isDelegateModalOpen, setDelegateModalOpen] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  
  // Payment State
  const [pendingRegistration, setPendingRegistration] = useState<RegistrationData | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDesc, setPaymentDesc] = useState('');

  const [delegateToken, setDelegateToken] = useState<string | null>(() => {
    const token = localStorage.getItem('delegateToken');
    if (token) {
        const payload = verifyToken(token);
        if (payload && payload.type === 'delegate' && payload.eventId === eventId) {
            return token;
        }
        localStorage.removeItem('delegateToken');
    }
    return null;
  });

  const initialFormData: RegistrationFormState = { firstName: '', lastName: '', email: '', password: '', ticketTierId: '' };
  const [formData, setFormData] = useState<RegistrationFormState>(initialFormData);

  // Load Public Data (Sessions, Speakers)
  useEffect(() => {
      if (eventId) {
          getPublicEventData(eventId).then(data => {
              setSessions(data.sessions);
              setSpeakers(data.speakers);
              setSponsors(data.sponsors);
              setTicketTiers(data.ticketTiers || []);
              setPublicDataLoading(false);
          }).catch(e => {
              console.warn("Failed to load public data for event:", eventId);
              setPublicDataLoading(false);
          });
      }
  }, [eventId]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetTokenParam = urlParams.get('resetToken');
    const inviteTokenParam = urlParams.get('inviteToken');

    if (resetTokenParam) {
        setResetToken(resetTokenParam);
        setView('passwordReset');
        setPublicTab('register'); // Force register view for reset for simplicity
    } else if (inviteTokenParam) {
        setInviteToken(inviteTokenParam);
        setPublicTab('register');
        getInvitationDetails(inviteTokenParam).then(details => {
            if (details && details.eventId === eventId) {
                setFormData(prev => ({ ...prev, email: details.inviteeEmail }));
                try {
                    window.history.replaceState({}, document.title, `/${eventId}`);
                } catch (e) {
                    // Ignore history errors in sandboxed environments
                }
            }
        });
    }
  }, [eventId]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    setFormData(initialFormData);
    setError('');
  };

  const executeRegistration = async (submissionData: RegistrationData) => {
      try {
          const result = await registerUser(eventId, submissionData, inviteToken || undefined);
          if (result.success) {
              await triggerRegistrationEmails(eventId, submissionData);
              setView('success');
          } else {
              setError(result.message);
          }
      } catch (err) {
          setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
  };

  const handleSubmit = async () => {
    if (!config) {
      setError("Configuration not loaded, cannot submit.");
      return;
    }
    setError('');
    
    const submissionData: RegistrationData = {
      ...formData,
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      createdAt: 0,
    };
    delete (submissionData as any).firstName;
    delete (submissionData as any).lastName;

    // Check for ticket payment
    if (formData.ticketTierId) {
        const tier = ticketTiers.find(t => t.id === formData.ticketTierId);
        if (tier && tier.price > 0) {
            setPendingRegistration(submissionData);
            setPaymentAmount(tier.price);
            setPaymentDesc(`Ticket: ${tier.name} (${config.event.name})`);
            setPaymentModalOpen(true);
            return;
        }
    }

    // Proceed if free or no ticket
    await executeRegistration(submissionData);
  };
  
  const handlePaymentSuccess = async () => {
      if (pendingRegistration) {
          // Record sale (optional: use returned ID from reg, but for now mocked)
          if (formData.ticketTierId) {
              await recordTicketSale(eventId, formData.ticketTierId, paymentAmount);
          }
          await executeRegistration(pendingRegistration);
          setPendingRegistration(null);
      }
  };

  const handleDelegateLogin = async (email: string, password_input: string): Promise<boolean> => {
    try {
      const result = await loginDelegate(eventId, email, password_input);
      if (result) {
        localStorage.setItem('delegateToken', result.token);
        setDelegateToken(result.token);
        setDelegateModalOpen(false);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleDelegateLogout = () => {
    localStorage.removeItem('delegateToken');
    setDelegateToken(null);
  };
  
  const handleAdminLoginSuccess = (token: string, user: { id: string; email: string; permissions: Permission[] }) => {
    onAdminLogin(token, user);
    setAdminModalOpen(false);
  };
  
  const isSoldOut = config && config.event.maxAttendees > 0 && registrationCount >= config.event.maxAttendees;

  // Render Logic Helpers
  const renderFooter = () => (
    <footer className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400 pb-8 border-t border-gray-200 dark:border-gray-700 pt-8">
      <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-2">
        <button type="button" onClick={() => setDelegateModalOpen(true)} className="hover:text-primary transition cursor-pointer">Delegate Portal</button>
        <span className="hidden sm:inline">&bull;</span>
        <button type="button" onClick={() => setAdminModalOpen(true)} className="hover:text-primary transition cursor-pointer">Admin Login</button>
        {config?.theme.websiteUrl && (
            <>
              <span className="hidden sm:inline">&bull;</span>
              <a href={config.theme.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition">Event Website</a>
            </>
        )}
          <span className="hidden sm:inline">&bull;</span>
          <button type="button" onClick={() => onNavigate('/')} className="hover:text-primary transition cursor-pointer">All Events</button>
      </div>
      <p className="mt-4">&copy; {new Date().getFullYear()} {config?.host.name || 'Event Platform'}. All rights reserved.</p>
    </footer>
  );

  if (delegateToken) {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><ContentLoader text="Loading portal..." /></div>}>
            <AccessibilityTools />
            <DelegatePortal onLogout={handleDelegateLogout} delegateToken={delegateToken} />
        </Suspense>
    );
  }
  
  if (isThemeLoading || publicDataLoading) {
    return (
      <div className="bg-background-color min-h-screen flex items-center justify-center">
        <ContentLoader />
      </div>
    );
  }

  if (themeError && !config) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 mb-8">
           <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
           </div>
           <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Event Not Found</h3>
           <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{themeError}</p>
           <button 
              onClick={() => onNavigate('/')}
              className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:text-sm"
           >
             View All Events
           </button>
        </div>
        {renderFooter()}
        <AdminLoginModal 
            isOpen={isAdminModalOpen}
            onClose={() => setAdminModalOpen(false)}
            onLoginSuccess={handleAdminLoginSuccess}
        />
        <AccessibilityTools />
      </div>
    );
  }

  return (
    <div className="bg-background-color min-h-screen font-sans text-gray-800 dark:text-gray-200 flex flex-col">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <AccessibilityTools />
        {/* Navbar */}
        <nav className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center cursor-pointer" onClick={() => setPublicTab('home')}>
                        {config?.theme.logoUrl ? (
                            <img src={config.theme.logoUrl} alt="Logo" className="h-8 w-auto mr-3" />
                        ) : (
                            <div className="h-8 w-8 bg-primary rounded-full mr-3 flex items-center justify-center text-white font-bold">E</div>
                        )}
                        <span className="font-bold text-xl text-gray-900 dark:text-white hidden sm:block truncate max-w-xs">{config?.event.name}</span>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-4">
                         {['Home', 'Agenda', 'Speakers'].map(tab => (
                             <button 
                                key={tab}
                                onClick={() => setPublicTab(tab.toLowerCase() as PublicTab)}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${publicTab === tab.toLowerCase() ? 'text-primary bg-primary/10' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                             >
                                 {tab}
                             </button>
                         ))}
                         <button 
                             onClick={() => setPublicTab('register')}
                             className={`ml-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${publicTab === 'register' ? 'bg-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                         >
                             Register
                         </button>
                    </div>
                </div>
            </div>
        </nav>

      <div id="main-content" className="relative z-10 flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <main className="max-w-5xl mx-auto">
            {publicTab === 'home' && config && (
                <PublicHome 
                    config={config} 
                    speakers={speakers} 
                    sponsors={sponsors}
                    ticketTiers={ticketTiers}
                    onRegister={() => setPublicTab('register')} 
                />
            )}

            {publicTab === 'agenda' && (
                <div className="animate-fade-in">
                    <h2 className="text-3xl font-bold mb-8 text-center text-gray-900 dark:text-white">Event Schedule</h2>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <AgendaView sessions={sessions} speakers={speakers} readOnly />
                    </div>
                </div>
            )}

            {publicTab === 'speakers' && (
                <div className="animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                        <DirectoryView speakers={speakers} sponsors={sponsors} />
                    </div>
                </div>
            )}

          {publicTab === 'register' && config && (
             <div className="max-w-4xl mx-auto animate-fade-in py-4">
                {view === 'passwordReset' && resetToken && (
                    <PasswordResetForm token={resetToken} />
                )}
                
                {(view === 'registration' || view === 'success') && (
                    <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-gray-700 relative">
                        {/* Decorative Top Bar */}
                        <div className="h-2.5 bg-gradient-to-r from-primary via-indigo-500 to-secondary w-full absolute top-0 left-0" />
                        
                        <div className="p-8 sm:p-14">
                            <header className="text-center mb-12">
                                <div className="inline-flex items-center justify-center p-1.5 mb-6 bg-primary/5 rounded-full">
                                    <span className="px-4 py-1.5 rounded-full bg-primary text-white text-xs font-bold uppercase tracking-widest shadow-sm">
                                        Registration Open
                                    </span>
                                </div>
                                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6 leading-tight">
                                    {config.event.name}
                                </h1>
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-gray-600 dark:text-gray-400 text-lg mb-6">
                                    <span className="flex items-center">
                                        <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                        {config.event.date}
                                    </span>
                                    <span className="hidden sm:block text-gray-300">•</span>
                                    <span className="flex items-center">
                                        <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                        {config.event.location}
                                    </span>
                                </div>
                                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
                                    Join us for an unforgettable experience. Secure your spot now.
                                </p>
                            </header>
                            
                            <div className="mt-8">
                            {error && <div className="mb-6"><Alert type="error" message={error} /></div>}

                            {view === 'success' ? (
                                <div className="text-center py-10 animate-fade-in-up">
                                <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-green-100 dark:bg-green-900/50 mb-8 animate-bounce">
                                    <svg className="h-12 w-12 text-green-600 dark:text-green-300 transform transition-transform duration-500 scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">You're All Set!</h3>
                                <p className="text-lg text-gray-600 dark:text-gray-300 mb-10 max-w-md mx-auto">
                                    Registration confirmed. Check your email for your ticket and event details.
                                </p>
                                <button
                                    onClick={() => {
                                    setView('registration');
                                    handleReset();
                                    }}
                                    className="inline-flex justify-center items-center py-3.5 px-8 border border-transparent rounded-xl shadow-lg text-lg font-bold text-white bg-primary hover:bg-primary/90 transform transition hover:-translate-y-1 hover:shadow-xl"
                                >
                                    Register Another Person
                                </button>
                                </div>
                            ) : isSoldOut ? (
                                <div className="text-center p-12 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-200 dark:border-yellow-800">
                                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Registration Closed</h2>
                                    <p className="mt-2 text-gray-600 dark:text-gray-400">We're sorry, but this event has reached its maximum capacity. Registration is no longer available.</p>
                                    <button 
                                        className="mt-6 px-6 py-2 bg-yellow-600 text-white rounded-full font-semibold hover:bg-yellow-700"
                                        onClick={() => {
                                            setFormData(prev => ({ ...prev, status: 'waitlist' }));
                                            handleSubmit();
                                        }}
                                    >
                                        Join Waitlist
                                    </button>
                                </div>
                            ) : (
                                <RegistrationForm
                                formData={formData}
                                onFormChange={handleFormChange}
                                onSubmit={handleSubmit}
                                onReset={handleReset}
                                isLoading={false}
                                config={config.formFields}
                                ticketTiers={ticketTiers}
                                />
                            )}
                            </div>
                        </div>
                    </div>
                )}
             </div>
          )}
          
           {renderFooter()}
        </main>
      </div>

      <AdminLoginModal 
        isOpen={isAdminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        onLoginSuccess={handleAdminLoginSuccess}
      />
      <DelegateLoginModal
        isOpen={isDelegateModalOpen}
        onClose={() => setDelegateModalOpen(false)}
        onLogin={handleDelegateLogin}
        eventId={eventId}
      />
      <PaymentModal 
        isOpen={isPaymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        delegateToken={null} // Public checkout has no token initially
        onSuccess={handlePaymentSuccess}
        fixedAmount={paymentAmount}
        description={paymentDesc}
      />
    </div>
  );
};

const EventPage: React.FC<EventPageContentProps> = (props) => (
    <ThemeProvider eventId={props.eventId}>
        <EventPageContent {...props} />
    </ThemeProvider>
);

function App() {
  const [isAppReady, setAppReady] = useState(false);
  
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      const payload = verifyToken(token);
      if (payload && payload.type === 'admin') {
        return {
          token,
          user: { email: payload.email, permissions: payload.permissions || [] }
        };
      }
      localStorage.removeItem('adminToken');
    }
    return null;
  });

  // Routing State
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
      // Check for backend status before rendering main app
      initializeApi().then(() => {
          setAppReady(true);
      });
  }, []);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigate = (path: string) => {
    try {
        window.history.pushState({}, '', path);
    } catch (e) {
        console.warn("Navigation URL update failed (likely due to sandbox environment):", e);
    }
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  const handleAdminLogin = (token: string, user: { id: string, email: string, permissions: Permission[] }) => {
    localStorage.setItem('adminToken', token);
    const { id, ...userForSession } = user;
    setAdminSession({ token, user: userForSession });
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    setAdminSession(null);
    navigate('/');
  };

  if (!isAppReady) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
              <div className="text-center">
                  <ContentLoader text="Connecting to server..." />
              </div>
          </div>
      );
  }

  // Kiosk Mode Handler
  if (currentPath === '/kiosk') {
      if (adminSession) {
          return <KioskView adminToken={adminSession.token} onExit={() => navigate('/')} />;
      } else {
          // If not logged in, show login modal then redirect to kiosk
          return (
              <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                  <AdminLoginModal 
                    isOpen={true} 
                    onClose={() => navigate('/')} 
                    onLoginSuccess={(token, user) => {
                        handleAdminLogin(token, user);
                        navigate('/kiosk');
                    }} 
                  />
                  <p>Admin authentication required for Kiosk Mode.</p>
              </div>
          );
      }
  }

  return (
    <ErrorBoundary>
      <AccessibilityTools />
      {adminSession ? (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><ContentLoader text="Loading dashboard..." /></div>}>
             {/* Wrap AdminPortal in ThemeProvider to ensure SettingsForm has context */}
             <ThemeProvider eventId="main-event">
                <AdminPortal onLogout={handleAdminLogout} adminToken={adminSession.token} user={adminSession.user} />
             </ThemeProvider>
        </Suspense>
      ) : (
        (() => {
          const ignoredPaths = [
            'assets', 'src', 'components', 'node_modules', 'static', 'public', 'json', 
            'manifest.json', 'favicon.ico', 'robots.txt', 'sitemap.xml', 
            'index.js', 'main.js', 'index.css', 'App.tsx', 
            '@vite', '@fs', '@react-refresh', 
            'admin', 'kiosk'
          ];

          const pathParts = currentPath.split('/').filter(p => p && p !== 'index.html');
          const candidateId = pathParts[0];
          
          // Strict check: if path is 'admin' or starts with 'admin', do NOT treat as event ID
          const isSystemPath = candidateId === 'admin' || candidateId === 'api' || candidateId === 'kiosk';
          
          const eventId = (candidateId && !candidateId.includes('.') && !candidateId.startsWith('@') && !ignoredPaths.includes(candidateId) && !isSystemPath) ? candidateId : undefined;

          if (eventId) {
              return <EventPage onAdminLogin={handleAdminLogin} eventId={eventId} onNavigate={navigate} />;
          }

          return <EventSelectionPage onAdminLogin={handleAdminLogin} onNavigate={navigate} />;
        })()
      )}
    </ErrorBoundary>
  );
}

export default App;
