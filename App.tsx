
import React, { useState, useEffect } from 'react';
import { type Permission } from './types';
import { verifyToken } from './server/auth';
import { AdminPortal } from './components/AdminPortal';
import { EventSelectionPage } from './components/EventSelectionPage';
import { EventApp } from './EventApp';

interface AdminSession {
  token: string;
  user: { email: string; permissions: Permission[] };
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

  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const onLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    // Listen for browser back/forward button clicks
    window.addEventListener('popstate', onLocationChange);
    return () => {
      window.removeEventListener('popstate', onLocationChange);
    };
  }, []);

  // Note: handleAdminLogin is no longer needed here because login modals on public
  // pages now trigger a page reload, and App will re-initialize its state from localStorage.
  
  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    setAdminSession(null);
    // Redirect to home page on logout to avoid being stuck on an admin-only view
    window.location.href = '/';
  };
  
  if (adminSession) {
    return <AdminPortal onLogout={handleAdminLogout} adminToken={adminSession.token} user={adminSession.user} />;
  }

  // Routing for public pages based on state
  const eventIdMatch = currentPath.match(/^\/([a-zA-Z0-9-_]+)$/);
  
  if (eventIdMatch) {
    const eventId = eventIdMatch[1];
    return <EventApp eventId={eventId} />;
  }

  // Default to event selection page for the root path "/" or any other path
  return <EventSelectionPage />;
}

export default App;
