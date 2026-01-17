
import React, { useState, useEffect, Suspense } from 'react';
import { type RegistrationData, type Permission, type Session, type Speaker, type Sponsor, type TicketTier } from './types';
import { registerUser, loginDelegate, getInvitationDetails, getPublicEventData, initializeApi, recordTicketSale } from './server/api';
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
          setPublicDataLoading(true);
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

              try {
                  const emailContent = await generateRegistrationEmails(
                      userForEmail, 
                      config, 
                      verificationLink, 
                      qrCodeUrl
                  );

                  await sendEmail({
                      to: userForEmail.email,
                      subject: emailContent.userEmail.subject,
                      body: emailContent.userEmail.body
                  });

              } catch (emailError) {
                  console.error("Gemini generation failed", emailError);
              }

              setView('success');
          } else if (!result.success) {
              setError((result as any).message || "Registration failed.");
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
    <footer className="mt-20 text-center text-sm text-gray-500 dark:text-gray-400 pb-12 border-t border-gray-100 dark:border-gray-800 pt-12">
      <div className="flex items-center justify-center flex-wrap gap-x-8 gap-y-4 mb-8">
        <button type="button" onClick={() => setDelegateModalOpen(true)} className="font-bold hover:text-primary transition-all uppercase tracking-widest text-[10px]">{t('nav.delegate')}</button>
        <button type="button" onClick={() => setAdminModalOpen(true)} className="font-bold hover:text-primary transition-all uppercase tracking-widest text-[10px]">{t('nav.login')}</button>
        {config?.theme.websiteUrl && (
            <a href={config.theme.websiteUrl} target="_blank" rel="noopener noreferrer" className="font-bold hover:text-primary transition-all uppercase tracking-widest text-[10px]">Official Site</a>
        )}
        <button type="button" onClick={() => onNavigate('/')} className="font-bold hover:text-primary transition-all uppercase tracking-widest text-[10px]">{t('nav.allEvents')}</button>
      </div>
      <div className="flex justify-center mb-6">
          <LanguageSelector />
      </div>
      <p className="font-medium opacity-50">&copy; {new Date().getFullYear()} {config?.host.name || 'Event Platform'}. Global Presence.</p>
    </footer>
  );

  if (delegateToken) {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><ContentLoader text="Initializing Portal..." /></div>}>
            <AccessibilityTools />
            <DelegatePortal onLogout={handleDelegateLogout} delegateToken={delegateToken} />
        </Suspense>
    );
  }
  
  if (isThemeLoading) {
    return <div className="bg-background-color min-h-screen flex items-center justify-center"><ContentLoader text="Syncing Terminal..." /></div>;
  }

  if (themeError && !config) {
    return (
      <div className="bg-gray-50 dark:bg-gray-950 min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 shadow-2xl rounded-[2rem] p-12 mb-12 border border-gray-100 dark:border-gray-800">
           <div className="w-16 h-16 bg-red-100 rounded-2xl mx-auto mb-6 flex items-center justify-center text-red-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
           </div>
           <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3 uppercase tracking-tighter">Event Unavailable</h3>
           <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 font-medium leading-relaxed">{themeError}</p>
           <button onClick={() => onNavigate('/')} className="w-full py-4 bg-primary text-white text-sm font-black rounded-xl hover:bg-primary/90 transition-all uppercase tracking-widest shadow-xl shadow-primary/20">Go Back</button>
        </div>
        {renderFooter()}
        <AdminLoginModal isOpen={isAdminModalOpen} onClose={() => setAdminModalOpen(false)} onLoginSuccess={handleAdminLoginSuccess} />
        <AccessibilityTools />
      </div>
    );
  }

  return (
    <div className="bg-background-color min-h-screen font-sans text-gray-800 dark:text-gray-200 flex flex-col selection:bg-primary/20">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <AccessibilityTools />
        
        <header className="bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-900 sticky top-0 z-[60]">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="flex justify-between h-20 items-center">
                    <div className="flex items-center cursor-pointer group" onClick={() => setPublicTab('home')}>
                        {config?.theme.logoUrl ? (
                            <img src={config.theme.logoUrl} alt="Logo" className="h-10 w-auto mr-4" />
                        ) : (
                            <div className="h-10 w-10 bg-primary rounded-xl mr-4 flex items-center justify-center text-white font-black shadow-lg shadow-primary/30 rotate-3 group-hover:rotate-12 transition-transform">FE</div>
                        )}
                        <span className="font-black text-xl text-gray-900 dark:text-white uppercase tracking-tighter truncate max-w-xs">{config?.event.name}</span>
                    </div>
                    
                    <div className="hidden md:flex items-center space-x-2">
                         {['home', 'agenda', 'speakers'].map(tId => (
                             <button 
                              key={tId} 
                              onClick={() => setPublicTab(tId as PublicTab)} 
                              className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${publicTab === tId ? 'text-primary bg-primary/5' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                             >
                                 {t(`nav.${tId}`)}
                             </button>
                         ))}
                         <button 
                          onClick={() => setPublicTab('register')} 
                          className={`ml-4 px-8 py-3 rounded-full text-xs font-black uppercase tracking-[0.1em] transition-all shadow-xl ${publicTab === 'register' ? 'bg-primary text-white shadow-primary/20 hover:bg-primary/90' : 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:scale-[1.05]'}`}
                         >
                             {t('nav.register')}
                         </button>
                    </div>

                    {/* Mobile Button Toggle Placeholder */}
                    <div className="md:hidden flex items-center">
                      <button onClick={() => setPublicTab('register')} className="px-5 py-2 bg-primary text-white text-[10px] font-black rounded-lg uppercase tracking-widest">Register</button>
                    </div>
                </div>
            </div>
        </header>

      <div id="main-content" className="relative z-10 flex-grow container mx-auto px-6 lg:px-8 py-12">
        <main className="max-w-6xl mx-auto">
            {publicTab === 'home' && config && (
              <PublicHome 
                config={config} 
                speakers={speakers} 
                sponsors={sponsors} 
                ticketTiers={ticketTiers} 
                onRegister={() => { setPublicTab('register'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
              />
            )}
            
            {publicTab === 'agenda' && (
              <div className="animate-fade-in max-w-4xl mx-auto">
                <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl p-10 border border-gray-100 dark:border-gray-800">
                  <AgendaView sessions={sessions} speakers={speakers} readOnly isLoading={publicDataLoading} />
                </div>
              </div>
            )}
            
            {publicTab === 'speakers' && (
              <div className="animate-fade-in">
                <DirectoryView speakers={speakers} sponsors={sponsors} isLoading={publicDataLoading} />
              </div>
            )}
            
            {publicTab === 'register' && config && (
             <div className="max-w-4xl mx-auto animate-fade-in">
                {view === 'passwordReset' && resetToken && <PasswordResetForm token={resetToken} />}
                {(view === 'registration' || view === 'success') && (
                    <div className="relative">
                        <div className="mb-12 text-center">
                            <h1 className="text-5xl sm:text-6xl font-black tracking-tighter text-gray-900 dark:text-white mb-4 uppercase">{t('nav.register')}</h1>
                            <p className="text-lg text-gray-500 dark:text-gray-400 font-medium">Join us for a transformative experience at {config.event.name}.</p>
                        </div>

                        <div className="mt-8">
                        {error && <div className="mb-8"><Alert type="error" message={error} /></div>}
                        {view === 'success' && successUser ? (
                            <div className="bg-white dark:bg-gray-900 shadow-3xl rounded-[3rem] p-12 sm:p-20 text-center animate-fade-in-up border border-gray-100 dark:border-gray-800">
                                <div className="mx-auto flex items-center justify-center h-28 w-28 rounded-[2rem] bg-green-100 dark:bg-green-900/30 mb-10">
                                    <svg className="h-14 w-14 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <h3 className="text-4xl font-black text-gray-900 dark:text-white mb-6 uppercase tracking-tighter">Access Confirmed</h3>
                                <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-lg mx-auto font-medium leading-relaxed">
                                  Your edge in the industry begins now. A digital receipt has been sent to <span className="text-primary font-bold">{successUser.email}</span>.
                                </p>
                                
                                <div className="bg-gray-50 dark:bg-gray-950 p-10 rounded-[2rem] border-2 border-dashed border-gray-200 dark:border-gray-800 mb-12 inline-block">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Digital Access Key</p>
                                    <img 
                                      src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(JSON.stringify({id: successUser.id, event: config.event.name, ver: '2.0'}))}`} 
                                      alt="Ticket QR" 
                                      className="w-56 h-56 mx-auto rounded-3xl shadow-2xl bg-white p-3 border-4 border-white" 
                                    />
                                    <p className="text-xs font-mono text-gray-400 mt-6 select-all">TICKET_ID: {successUser.id}</p>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row justify-center gap-4">
                                  <button onClick={() => { setView('registration'); handleReset(); }} className="px-10 py-5 border-2 border-gray-200 dark:border-gray-800 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">New Entry</button>
                                  <button onClick={() => setDelegateModalOpen(true)} className="px-10 py-5 bg-primary text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all">Log in to Portal</button>
                                </div>
                            </div>
                        ) : isSoldOut ? (
                            <div className="text-center p-20 bg-gray-50 dark:bg-gray-950 rounded-[3rem] border-4 border-gray-100 dark:border-gray-900">
                                <h2 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-4">Capacity Reached</h2>
                                <p className="text-lg text-gray-500 font-medium">This sector is fully occupied. Please contact our support team to join the waitlist.</p>
                            </div>
                        ) : (
                            <RegistrationForm 
                              formData={formData} 
                              onFormChange={handleFormChange} 
                              onSubmit={handleSubmit} 
                              onReset={handleReset} 
                              isLoading={isSubmitting} 
                              config={config.formFields} 
                              ticketTiers={ticketTiers} 
                            />
                        )}
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
          console.warn("Navigation failed", e);
      }
      setCurrentPath(path);
  };

  const handleAdminLogin = (token: string, user: { id: string; email: string; permissions: Permission[] }) => {
      setAdminToken(token);
      setAdminUser(user);
      localStorage.setItem('adminToken', token);
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

  if (adminToken && adminUser) {
      if (rootSegment === 'admin' || (rootSegment === undefined)) {
           return (
             <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><ContentLoader text="Initializing Core..." /></div>}>
                <AdminPortal onLogout={handleAdminLogout} adminToken={adminToken} user={adminUser} />
             </Suspense>
           );
      }
  }

  if (rootSegment === 'kiosk') {
      const kioskEventId = pathParts[1] || 'main-event';
      if (!adminToken) return <div className="p-20 text-center font-black uppercase tracking-tighter text-2xl">Terminal Restricted.</div>;
      return <KioskView adminToken={adminToken} eventId={kioskEventId} onExit={() => handleNavigate('/admin')} />;
  }

  if (rootSegment === 'projector' && pathParts[1]) {
      return <ProjectorView sessionId={pathParts[1]} onExit={() => window.close()} />;
  }

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
