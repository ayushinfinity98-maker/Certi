import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginPage } from './components/LoginPage';
import { AdminDashboard } from './components/AdminDashboard';
import { CaDashboard } from './components/CaDashboard';
import { VerificationPage } from './components/VerificationPage';
import { ShieldAlert, Award, LogOut } from 'lucide-react';

function AppContent() {
  const { currentUser, role, caProfile, adminProfile, isLoading, authError, logout } = useAuth();
  const [currentView, setCurrentView] = useState<'app' | 'verify'>('app');
  const [verificationCertId, setVerificationCertId] = useState<string>('');

  // Check URL params for verification link: ?verify=GSAP-XXXX
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const verifyParam = urlParams.get('verify');
      const path = window.location.pathname;

      if (verifyParam) {
        setVerificationCertId(verifyParam);
        setCurrentView('verify');
      } else if (path.startsWith('/verify/')) {
        const idFromPath = path.replace('/verify/', '');
        if (idFromPath) {
          setVerificationCertId(idFromPath);
          setCurrentView('verify');
        }
      }
    }
  }, []);

  if (currentView === 'verify') {
    return (
      <VerificationPage
        initialCertId={verificationCertId}
        onBackToApp={() => {
          setCurrentView('app');
          // Clear query params without full page reload
          if (window.history.pushState) {
            window.history.pushState({}, document.title, window.location.pathname);
          }
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex items-center space-x-1 mb-4 select-none animate-pulse">
          <span className="text-3xl font-bold text-[#4285F4]">G</span>
          <span className="text-3xl font-bold text-[#EA4335]">o</span>
          <span className="text-3xl font-bold text-[#FBBC05]">o</span>
          <span className="text-3xl font-bold text-[#4285F4]">g</span>
          <span className="text-3xl font-bold text-[#34A853]">l</span>
          <span className="text-3xl font-bold text-[#EA4335]">e</span>
        </div>
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-gray-500 font-medium tracking-wide">
          Loading Campus Ambassador System...
        </p>
      </div>
    );
  }

  // Not signed in
  if (!currentUser || !role) {
    // If signed in but no recognized role
    if (currentUser && !role) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-200 p-8 max-w-md w-full shadow-lg text-center space-y-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              Access Restricted
            </h2>
            {authError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 leading-relaxed text-left">
                {authError}
              </div>
            ) : (
              <p className="text-xs text-gray-600 leading-relaxed">
                Your Google account <span className="font-semibold text-gray-900 font-mono">"{currentUser.email}"</span> is not registered as an authorized Campus Ambassador or Super Administrator for Campus Ambassador System.
              </p>
            )}
            <p className="text-[11px] text-gray-400">
              Please contact the Super Admin at <span className="font-mono text-blue-600">ayushinfinity98@gmail.com</span> for access assistance.
            </p>
            <div className="pt-2">
              <button
                onClick={() => logout()}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out & Try Another Account</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <LoginPage
        onGoToVerify={() => setCurrentView('verify')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      <Navbar onGoToVerify={() => setCurrentView('verify')} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {role === 'superadmin' || role === 'admin' ? (
          <AdminDashboard
            adminUid={currentUser.uid}
            adminEmail={currentUser.email || 'admin@google.com'}
          />
        ) : caProfile ? (
          <CaDashboard
            ca={caProfile}
            actorEmail={currentUser.email || caProfile.email}
          />
        ) : (
          <div className="p-8 text-center text-gray-500">
            Ambassador profile missing. Please log out and sign in again.
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        Campus Ambassador System &bull; Certificate Management Platform
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
