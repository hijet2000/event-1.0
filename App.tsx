
import React, { useState, useEffect, Suspense } from 'react';
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
import { LanguageProvider, useTranslation } from './contexts/LanguageContext';
import { LanguageSelector } from './components/LanguageSelector';
import { EventSelectionPage } from './components/EventSelectionPage';
import { CountdownTimer } from './components/CountdownTimer';
import { AgendaView } from './components/AgendaView';
import { DirectoryView } from './components/DirectoryView';
import { PublicHome } from './components/PublicHome';
import { AccessibilityTools } from './components/AccessibilityTools';
import { PaymentModal } from './components/PaymentModal';
import { KioskView } from './components/KioskView';
import { ProjectorView } from './components/ProjectorView';
import { configureBackgroundFetch } from './services/native';
import { generateRegistrationEmails } from './services/geminiService';
import { sendEmail } from './services/emailService';

// Lazy load heavy portals
const AdminPortal = React.lazy(() => import('./components/AdminPortal').then(module => ({ default: module.AdminPortal })));
const DelegatePortal = React.lazy(() => import('./components/DelegatePortal').then(module => ({ default: module.DelegatePortal })));

type View = 'registration' | 'success' | 'passwordReset';
type PublicTab = 'home' | 'agenda' | 'speakers' | 'register';

export interface RegistrationFormState {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  ticketTierId?: string;
  [key: string]: any;
}

interface EventPageContentProps {
  onAdminLogin: (token: string, user: { id: string; email: string; permissions: Permission[]; }) => void;
  eventId: string;
  onNavigate: (path: string) => void;
}

const EventPageContent: React.FC<EventPageContentProps> = ({ onAdminLogin, eventId, onNavigate }) => {
  const { config, registrationCount, isLoading: isThemeLoading, error: themeError } = useTheme();
  const { t } = useTranslation();
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([]);
  const [publicDataLoading, setPublicDataLoading] = useState(true);

  const [publicTab, setPublicTab] = useState<PublicTab>('home');
  const [view, setView] = useState<View>('registration');
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [successUser, setSuccessUser] = useState<RegistrationData | null>(null);

  const [isAdminModalOpen, setAdminModalOpen] = useState(false);
  const [isDelegateModalOpen, setDelegateModalOpen] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  
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

  useEffect(() => {
    if (config?.formFields) {
      setFormData(prev => {
        const next = { ...prev };
        let hasChanges = false;
        config.formFields.forEach(field => {
          if (field.enabled && next[field.id] === undefined) {
            next[field.id] = ''; 
            hasChanges = true;
          }
        });
        return hasChanges ? next : prev;
      });
    }
  }, [config]);

  useEffect(() => {
      if (eventId) {
          getPublicEventData(eventId).then(data => {
              setSessions(data.sessions);
              setSpeakers(data.speakers);
              setSponsors(data.sponsors);
              setTicketTiers(data.ticketTiers || []);
              setPublicDataLoading(false);
          }).catch(e => {
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
        setPublicTab('register'); 
    } else if (inviteTokenParam) {
        setInviteToken(inviteTokenParam);
        setPublicTab('register');
        getInvitationDetails(inviteTokenParam).then(details => {
            if (details && details.eventId === eventId) {
                setFormData(prev => ({ ...prev, email: details.inviteeEmail }));
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
    setSuccessUser(null);
    setError('');
  };

  const executeRegistration = async (submissionData: RegistrationData) => {
      try {
          const result = await registerUser(eventId, submissionData, inviteToken || undefined);
          if (result.success && config) {
              const userForEmail = result.user || { ...submissionData, id: 'temp-id' };
              
              // Enhanced QR Data for ticket validation
              const verificationLink = `${window.location.origin}/verify/${userForEmail.id}`;
              const qrData = JSON.stringify({
                  id: userForEmail.id,
                  event: config.event.name || 'Event',
                  url: verificationLink,
                  token: `secure_${userForEmail.id?.slice(-6)}_${Date.now()}`,
                  ver: '2.0'
              });
              const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;

              setSuccessUser(userForEmail);

              // 1. Generate Personalized Confirmation Emails using Gemini API
              try {
                  const emailContent = await generateRegistrationEmails(
                      userForEmail, 
                      config, 
                      verificationLink, 
                      qrCodeUrl
                  );

                  // 2. Trigger the Email Delivery Service
                  await sendEmail({
                      to: userForEmail.email,
                      subject: emailContent.userEmail.subject,
                      body: emailContent.userEmail.body
                  });

                  console.log("Confirmation email successfully triggered via Gemini.");
              } catch (emailError) {
                  console.error("Gemini email generation failed, but registration was successful:", emailError);
                  // Non-blocking error for UI, but we log it.
              }

              setView('success');
          } else if (!result.success) {
              setError(result.message);
          }
      } catch (err) {
          setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
  };

  const handleSubmit = async () => {
    if (!config) {
      setError("Configuration not loaded.");
      return;
    }
    setError('');
    setIsSubmitting(true);
    
    const submissionData: RegistrationData = {
      ...formData,
      name: `${formData.firstName} ${formData.lastName}`.trim(),
      createdAt: Date.now(),
    };
    delete (submissionData as any).firstName;
    delete (submissionData as any).lastName;

    if (formData.ticketTierId) {
        const tier = ticketTiers.find(t => t.id === formData.ticketTierId);
        if (tier && tier.price > 0) {
            setPendingRegistration(submissionData);
            setPaymentAmount(tier.price);
            setPaymentDesc(`Ticket: ${tier.name} (${config.event.name})`);
            setPaymentModalOpen(true);
            setIsSubmitting(false); 
            return;
        }
    }

    await executeRegistration(submissionData);
    setIsSubmitting(false);
  };
  
  const handlePaymentSuccess = async () => {
      if (pendingRegistration) {
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

  const renderFooter = () => (
    <footer className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400 pb-8 border-t border-gray-200 dark:border-gray-700 pt-8">
      <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-2 mb-4">
        <button type="button" onClick={() => setDelegateModalOpen(true)} className="hover:text-primary transition cursor-pointer">{t('nav.delegate')}</button>
        <span className="hidden sm:inline">&bull;</span>
        <button type="button" onClick={() => setAdminModalOpen(true)} className="hover:text-primary transition cursor-pointer">{t('nav.login')}</button>
        {config?.theme.websiteUrl && (
            <>
              <span className="hidden sm:inline">&bull;</span>
              <a href={config.theme.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition">Event Website</a>
            </>
        )}
          <span className="hidden sm:inline">&bull;</span>
          <button type="button" onClick={() => onNavigate('/')} className="hover:text-primary transition cursor-pointer">{t('nav.allEvents')}</button>
      </div>
      <div className="flex justify-center mb-4">
          <LanguageSelector />
      </div>
      <p>&copy; {new Date().getFullYear()} {config?.host.name || 'Event Platform'}. All rights reserved.</p>
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
    return <div className="bg-background-color min-h-screen flex items-center justify-center"><ContentLoader /></div>;
  }

  if (themeError && !config) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 mb-8">
           <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Event Not Found</h3>
           <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{themeError}</p>
           <button onClick={() => onNavigate('/')} className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-primary/90">View All Events</button>
        </div>
        {renderFooter()}
        <AdminLoginModal isOpen={isAdminModalOpen} onClose={() => setAdminModalOpen(false)} onLoginSuccess={handleAdminLoginSuccess} />
        <AccessibilityTools />
      </div>
    );
  }

  return (
    <div className="bg-background-color min-h-screen font-sans text-gray-800 dark:text-gray-200 flex flex-col">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <AccessibilityTools />
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
                         {['home', 'agenda', 'speakers'].map(tId => (
                             <button key={tId} onClick={() => setPublicTab(tId as PublicTab)} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${publicTab === tId ? 'text-primary bg-primary/10' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                                 {t(`nav.${tId}`)}
                             </button>
                         ))}
                         <button onClick={() => setPublicTab('register')} className={`ml-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${publicTab === 'register' ? 'bg-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                             {t('nav.register')}
                         </button>
                    </div>
                </div>
            </div>
        </nav>

      <div id="main-content" className="relative z-10 flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <main className="max-w-5xl mx-auto">
            {publicTab === 'home' && config && <PublicHome config={config} speakers={speakers} sponsors={sponsors} ticketTiers={ticketTiers} onRegister={() => setPublicTab('register')} />}
            {publicTab === 'agenda' && <div className="animate-fade-in"><h2 className="text-3xl font-bold mb-8 text-center text-gray-900 dark:text-white">Schedule</h2><div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"><AgendaView sessions={sessions} speakers={speakers} readOnly /></div></div>}
            {publicTab === 'speakers' && <div className="animate-fade-in"><div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"><DirectoryView speakers={speakers} sponsors={sponsors} /></div></div>}
            {publicTab === 'register' && config && (
             <div className="max-w-4xl mx-auto animate-fade-in py-4">
                {view === 'passwordReset' && resetToken && <PasswordResetForm token={resetToken} />}
                {(view === 'registration' || view === 'success') && (
                    <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-gray-700 relative">
                        <div className="h-2.5 bg-gradient-to-r from-primary via-indigo-500 to-secondary w-full absolute top-0 left-0" />
                        <div className="p-8 sm:p-14">
                            <header className="text-center mb-12">
                                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6 leading-tight">{config.event.name}</h1>
                                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">{config.event.description}</p>
                            </header>
                            <div className="mt-8">
                            {error && <div className="mb-6"><Alert type="error" message={error} /></div>}
                            {view === 'success' && successUser ? (
                                <div className="text-center py-10 animate-fade-in-up flex flex-col items-center">
                                    <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-green-100 dark:bg-green-900/50 mb-8 animate-bounce"><svg className="h-12 w-12 text-green-600 dark:text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>
                                    <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Registration Confirmed!</h3>
                                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-md mx-auto">A copy has been sent to <strong>{successUser.email}</strong>.</p>
                                    <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 mb-10 text-center">
                                        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Your Event Pass</p>
                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(JSON.stringify({id: successUser.id, event: config.event.name, ver: '2.0'}))}`} alt="Ticket QR" className="w-48 h-48 mx-auto rounded-lg shadow-sm bg-white p-2" />
                                        <p className="text-xs text-gray-400 mt-4">ID: {successUser.id}</p>
                                    </div>
                                    <button onClick={() => { setView('registration'); handleReset(); }} className="inline-flex justify-center items-center py-3.5 px-8 border border-transparent rounded-xl shadow-lg text-lg font-bold text-white bg-primary hover:bg-primary/90 transform transition hover:-translate-y-1">Register Another Person</button>
                                </div>
                            ) : isSoldOut ? (
                                <div className="text-center p-12 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-200 dark:border-yellow-800">
                                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Registration Closed</h2>
                                    <p className="mt-2 text-gray-600 dark:text-gray-400">Capacity reached.</p>
                                </div>
                            ) : (
                                <RegistrationForm formData={formData} onFormChange={handleFormChange} onSubmit={handleSubmit} onReset={handleReset} isLoading={isSubmitting} config={config.formFields} ticketTiers={ticketTiers} />
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
      <AdminLoginModal isOpen={isAdminModalOpen} onClose={() => setAdminModalOpen(false)} onLoginSuccess={handleAdminLoginSuccess} />
      <DelegateLoginModal isOpen={isDelegateModalOpen} onClose={() => setDelegateModalOpen(false)} onLogin={handleDelegateLogin} eventId={eventId} />
      <PaymentModal isOpen={isPaymentModalOpen} onClose={() => setPaymentModalOpen(false)} delegateToken={null} onSuccess={handlePaymentSuccess} fixedAmount={paymentAmount} description={paymentDesc} />
    </div>
  );
}

const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [adminToken, setAdminToken] = useState<string | null>(localStorage.getItem('adminToken'));
  const [adminUser, setAdminUser] = useState<{ id: string; email: string; permissions: Permission[] } | null>(() => {
    // Attempt to initialize admin user profile synchronously from existing token
    const token = localStorage.getItem('adminToken');
    if (token) {
        const payload = verifyToken(token);
        if (payload && payload.type === 'admin') {
            return { id: payload.id, email: payload.email, permissions: payload.permissions || [] };
        }
    }
    return null;
  });

  useEffect(() => {
    initializeApi().catch(console.error);
    configureBackgroundFetch(async () => {
        console.log("Background fetch event");
    });
  }, []);

  useEffect(() => {
    // Keep user state in sync if token changes externally
    if (adminToken && !adminUser) {
       const payload = verifyToken(adminToken);
       if (payload && payload.type === 'admin') {
           setAdminUser({ id: payload.id, email: payload.email, permissions: payload.permissions || [] });
       } else {
           setAdminToken(null);
           setAdminUser(null);
           localStorage.removeItem('adminToken');
       }
    }
  }, [adminToken, adminUser]);

  useEffect(() => {
      const onPopState = () => setCurrentPath(window.location.pathname);
      window.addEventListener('popstate', onPopState);
      return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleNavigate = (path: string) => {
      try {
          window.history.pushState({}, '', path);
      } catch (e) {
          // Fallback for sandboxed origins where pushState fails
          console.warn("Navigation failed (pushState blocked by browser):", e);
      }
      setCurrentPath(path);
  };

  const handleAdminLogin = (token: string, user: { id: string; email: string; permissions: Permission[] }) => {
      setAdminToken(token);
      setAdminUser(user);
      localStorage.setItem('adminToken', token);
      // Explicitly navigate to admin route to ensure portal loads correctly
      handleNavigate('/admin');
  };

  const handleAdminLogout = () => {
      setAdminToken(null);
      setAdminUser(null);
      localStorage.removeItem('adminToken');
      handleNavigate('/');
  };

  const pathParts = currentPath.split('/').filter(Boolean);
  const rootSegment = pathParts[0];

  // Admin Portal View
  if (adminToken && adminUser) {
      if (rootSegment === 'admin' || (rootSegment === undefined)) {
           return (
             <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><ContentLoader text="Initializing Portal..." /></div>}>
                <AdminPortal onLogout={handleAdminLogout} adminToken={adminToken} user={adminUser} />
             </Suspense>
           );
      }
  }

  if (rootSegment === 'kiosk') {
      const kioskEventId = pathParts[1] || 'main-event';
      if (!adminToken) return <div className="p-10 text-center">Access Denied. Admin login required to launch Kiosk. <button onClick={() => handleNavigate('/')} className="text-primary underline">Go Home</button></div>;
      return <KioskView adminToken={adminToken} eventId={kioskEventId} onExit={() => handleNavigate('/admin')} />;
  }

  if (rootSegment === 'projector' && pathParts[1]) {
      return <ProjectorView sessionId={pathParts[1]} onExit={() => window.close()} />;
  }

  // Public Event Page View
  if (rootSegment && rootSegment !== 'admin') {
      return (
        <ThemeProvider eventId={rootSegment}>
            <LanguageProvider>
                <EventPageContent 
                    eventId={rootSegment} 
                    onAdminLogin={handleAdminLogin} 
                    onNavigate={handleNavigate} 
                />
            </LanguageProvider>
        </ThemeProvider>
      );
  }

  // Home / Event Selection View
  return (
    <LanguageProvider>
        <EventSelectionPage 
            onAdminLogin={handleAdminLogin} 
            onNavigate={handleNavigate} 
        />
    </LanguageProvider>
  );
};

export default App;
