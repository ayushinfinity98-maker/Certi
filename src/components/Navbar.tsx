import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Shield, User, Search, Award } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface NavbarProps {
  onGoToVerify: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onGoToVerify }) => {
  const { role, caProfile, adminProfile, currentUser, logout } = useAuth();

  const displayName = role === 'superadmin' || role === 'admin'
    ? (adminProfile?.name || currentUser?.displayName || 'Super Administrator')
    : (caProfile?.name || 'Campus Ambassador');

  const subText = role === 'superadmin' || role === 'admin'
    ? 'Super Admin Console'
    : `${caProfile?.caRole === 'main_ca' ? 'Main CA • ' : ''}${caProfile?.college || 'Ambassador'} (${caProfile?.caId || ''})`;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <BrandLogo size="md" />
          <div className="h-5 w-[1px] bg-gray-300" />
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-bold text-gray-900 leading-tight">
              Campus Ambassador System
            </span>
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
              Certificate Management Portal
            </span>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={onGoToVerify}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
          >
            <Search className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
            <span className="hidden sm:inline">Public</span> Verification
          </button>

          {/* User Chip */}
          <div className="flex items-center space-x-2 pl-2 border-l border-gray-200">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
              role === 'superadmin' || role === 'admin'
                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                : 'bg-blue-100 text-blue-700 border border-blue-200'
            }`}>
              {role === 'superadmin' || role === 'admin' ? (
                <Shield className="w-4 h-4" />
              ) : (
                <Award className="w-4 h-4" />
              )}
            </div>

            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-bold text-gray-900 leading-tight">
                {displayName}
              </span>
              <span className="text-[10px] text-gray-500 font-medium">
                {subText}
              </span>
            </div>

            <button
              onClick={() => logout()}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition ml-1"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </header>
  );
};
