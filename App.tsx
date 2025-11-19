
import React, { useState, useEffect } from 'react';
import { type RegistrationData, type Permission, type Session, type Speaker, type Sponsor } from './types';
import { registerUser, loginDelegate, triggerRegistrationEmails, getInvitationDetails, getPublicEventData } from './server/api';
import { verifyToken } from './server/auth';
import { RegistrationForm } from './components/RegistrationForm';
import { Alert } from './components/Alert';
import { Logo } from './components/Logo';
import { ContentLoader } from './components/ContentLoader';
import { AdminLoginModal } from './components/AdminLoginModal';
import { PasswordResetForm } from './components/PasswordResetForm';
import { DelegateLoginModal } from './components/DelegateLoginModal';
import { DelegatePortal } from './components/DelegatePortal';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AdminPortal } from './components/AdminPortal';
import { EventSelectionPage } from './components/EventSelectionPage';
import { CountdownTimer } from './components/CountdownTimer';
import { AgendaView } from './components/AgendaView';
import { DirectoryView } from './components/DirectoryView';
import { PublicHome } from './components/PublicHome';

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
  [key: string]: any;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
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
  const [publicDataLoading, setPublicDataLoading] = useState(true);

  // Navigation State
  const [publicTab, setPublicTab] = useState<PublicTab>('home');

  const [view, setView] = useState<View>('registration');
  const [error, setError] = useState<string>('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const [isAdminModalOpen, setAdminModalOpen] = useState(false);
  const [isDelegateModalOpen, setDelegateModalOpen] = useState(false);
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

  const initialFormData: RegistrationFormState = { firstName: '', lastName: '', email: '', password: '' };
  const [formData, setFormData] = useState<RegistrationFormState>(initialFormData);

  // Load Public Data (Sessions, Speakers)
  useEffect(() => {
      if (eventId) {
          getPublicEventData(eventId).then(data => {
              setSessions(data.sessions);
              setSpeakers(data.speakers);
              setSponsors(data.sponsors);
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
    return <DelegatePortal onLogout={handleDelegateLogout} delegateToken={delegateToken} />;
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
      </div>
    );
  }

  return (
    <div className="bg-background-color min-h-screen font-sans text-gray-800 dark:text-gray-200 flex flex-col">
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

      <div className="relative z-10 flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <main className="max-w-5xl mx-auto">
            {publicTab === 'home' && config && (
                <PublicHome 
                    config={config} 
                    speakers={speakers} 
                    sponsors={sponsors}
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
             <div className="max-w-3xl mx-auto animate-fade-in">
                {view === 'passwordReset' && resetToken && (
                    <PasswordResetForm token={resetToken} />
                )}
                
                {(view === 'registration' || view === 'success') && (
                    <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-2xl overflow-hidden">
                    <div className="p-8 sm:p-12">
                        <header className="text-center">
                        <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl" style={{ color: config.theme.colorPrimary }}>
                            Register for {config.event.name}
                        </h1>
                         <p className="mt-4 text-gray-600 dark:text-gray-400">
                            Secure your spot today.
                        </p>
                        </header>
                        
                        <div className="mt-10">
                        {error && <div className="mb-6"><Alert type="error" message={error} /></div>}

                        {view === 'success' ? (
                            <div className="text-center">
                            <Alert type="success" message="Registration Successful! Please check your email for a confirmation message." />
                            <button
                                onClick={() => {
                                setView('registration');
                                handleReset();
                                }}
                                className="mt-6 w-full sm:w-auto inline-flex justify-center items-center py-3 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
                            >
                                Register Another Person
                            </button>
                            </div>
                        ) : isSoldOut ? (
                            <div className="text-center p-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Registration Closed</h2>
                                <p className="mt-2 text-gray-600 dark:text-gray-400">We're sorry, but this event has reached its maximum capacity. Registration is no longer available.</p>
                            </div>
                        ) : (
                            <RegistrationForm
                            formData={formData}
                            onFormChange={handleFormChange}
                            onSubmit={handleSubmit}
                            onReset={handleReset}
                            isLoading={false}
                            config={config.formFields}
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
    </div>
  );
};

const EventPage: React.FC<EventPageContentProps> = (props) => (
    <ThemeProvider eventId={props.eventId}>
        <EventPageContent {...props} />
    </ThemeProvider>
);

function App() {
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

  return (
    <ErrorBoundary>
      {adminSession ? (
        <AdminPortal onLogout={handleAdminLogout} adminToken={adminSession.token} user={adminSession.user} />
      ) : (
        (() => {
          const ignoredPaths = [
            'assets', 'src', 'components', 'node_modules', 'static', 'public', 'json', 
            'manifest.json', 'favicon.ico', 'robots.txt', 'sitemap.xml', 
            'index.js', 'main.js', 'index.css', 'App.tsx', 
            '@vite', '@fs', '@react-refresh', 
            'admin' // Explicitly ignore 'admin'
          ];

          const pathParts = currentPath.split('/').filter(p => p && p !== 'index.html');
          const candidateId = pathParts[0];
          
          // Strict check: if path is 'admin' or starts with 'admin', do NOT treat as event ID
          const isSystemPath = candidateId === 'admin' || candidateId === 'api';
          
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
