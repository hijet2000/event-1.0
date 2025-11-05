

import React, { useState, useEffect } from 'react';
import { type RegistrationData, type Permission } from './types';
// Fix: Changed import for verifyToken to import from auth service directly.
import { registerUser, loginDelegate, triggerRegistrationEmails, getInvitationDetails } from './server/api';
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

type View = 'registration' | 'success' | 'passwordReset';

interface AdminSession {
  token: string;
  user: { email: string; permissions: Permission[] };
}

interface AppContentProps {
  onAdminLogin: (token: string, user: { id: string, email: string, permissions: Permission[] }) => void;
}

const AppContent: React.FC<AppContentProps> = ({ onAdminLogin }) => {
  const { config, registrationCount, isLoading: isThemeLoading, error: themeError } = useTheme();

  const [view, setView] = useState<View>('registration');
  const [error, setError] = useState<string>('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  // Admin State - only for opening the modal
  const [isAdminModalOpen, setAdminModalOpen] = useState(false);
  
  // Delegate State
  const [isDelegateModalOpen, setDelegateModalOpen] = useState(false);
  const [delegateToken, setDelegateToken] = useState<string | null>(localStorage.getItem('delegateToken'));

  const initialFormData = { name: '', email: '', password: '' };
  const [formData, setFormData] = useState<RegistrationData>(initialFormData as RegistrationData);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetTokenParam = urlParams.get('resetToken');
    const inviteTokenParam = urlParams.get('inviteToken');

    if (resetTokenParam) {
        setResetToken(resetTokenParam);
        setView('passwordReset');
    } else if (inviteTokenParam) {
        setInviteToken(inviteTokenParam);
        getInvitationDetails(inviteTokenParam).then(details => {
            if (details) {
                setFormData(prev => ({ ...prev, email: details.inviteeEmail }));
                // Clean up URL
                window.history.replaceState({}, document.title, `/`);
            }
        });
    } else {
      setView('registration');
    }
  }, []);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    setFormData(initialFormData as RegistrationData);
    setError('');
  };

  const handleSubmit = async () => {
    if (!config) {
      setError("Configuration not loaded, cannot submit.");
      return;
    }
    setError('');
    
    try {
      const result = await registerUser(formData, inviteToken || undefined);
      if (result.success) {
        await triggerRegistrationEmails(formData);
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
      const result = await loginDelegate(email, password_input);
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

  if (delegateToken) {
    return <DelegatePortal onLogout={handleDelegateLogout} delegateToken={delegateToken} />;
  }
  
  if (isThemeLoading) {
    return (
      <div className="bg-background-color min-h-screen flex items-center justify-center">
        <ContentLoader />
      </div>
    );
  }

  if (themeError && !config) {
    return (
      <div className="bg-background-color min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md mx-auto">
          <Alert type="error" message={themeError} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-color min-h-screen font-sans text-gray-800 dark:text-gray-200">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0" 
        style={{ backgroundImage: `url(${config?.theme.pageImageUrl})`, opacity: 0.1 }}
      ></div>
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20">
        <main className="max-w-3xl mx-auto">
          {view === 'passwordReset' && config && resetToken && (
             <PasswordResetForm token={resetToken} />
          )}
          
          {(view === 'registration' || view === 'success') && config && (
            <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-2xl overflow-hidden animate-fade-in">
              <div className="p-8 sm:p-12">
                <header className="text-center">
                  <Logo />
                  <h1 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl" style={{ color: config.theme.colorPrimary }}>
                    {config.event.name}
                  </h1>
                  <div className="mt-4 flex items-center justify-center flex-wrap gap-x-6 gap-y-2 text-lg text-secondary" style={{ color: config.theme.colorSecondary }}>
                      <div className="flex items-center space-x-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span>{config.event.date}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span>{config.event.location}</span>
                      </div>
                  </div>
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
          
           <footer className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
              <button onClick={() => setDelegateModalOpen(true)} className="hover:text-primary transition">Delegate Portal</button>
              <span>&bull;</span>
              <button onClick={() => setAdminModalOpen(true)} className="hover:text-primary transition">Admin Login</button>
              {config?.theme.websiteUrl && (
                  <>
                    <span>&bull;</span>
                    <a href={config.theme.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition">Event Website</a>
                  </>
              )}
            </footer>
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
      />
    </div>
  );
}


function App() {
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      const payload = verifyToken(token); // Using a synchronous mock verify for initial load
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

  const handleAdminLogin = (token: string, user: { id: string, email: string, permissions: Permission[] }) => {
    const { id, ...userForSession } = user;
    setAdminSession({ token, user: userForSession });
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    setAdminSession(null);
  };
  
  if (adminSession) {
    return <AdminPortal onLogout={handleAdminLogout} adminToken={adminSession.token} user={adminSession.user} />;
  }

  return (
    <ThemeProvider>
        <AppContent onAdminLogin={handleAdminLogin} />
    </ThemeProvider>
  );
}

export default App;
