import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { User, LogOut } from 'lucide-react';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { t } = useLanguage();

  const navigationItems = [
    { key: 'dashboard', path: '/dashboard', label: 'E-Estimate' },
    { key: 'works', path: '/works', label: t('nav.works') },
    { key: 'subworks', path: '/subworks', label: t('nav.subworks') },
    { key: 'compare', path: '/compare', label: t('nav.compare') },
    { key: 'measurement-book', path: '/measurement-book', label: 'Measurement Book (MB)' },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="bg-white shadow-lg border-b border-gray-200">
      {/* Top Bar - Logo, Title, Profile, Language */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-12">
          {/* Logo and Title */}
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">E</span>
              </div>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {t('dashboard.title')}
              </h1>
              <p className="text-xs text-gray-500">ZP Chandrapur</p>
            </div>
          </div>

          {/* User Actions */}
          <div className="flex items-center space-x-4">
            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-700">
                  {user?.user_metadata?.full_name || user?.email}
                </span>
              </div>
              
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">{t('nav.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Bar */}
      <div className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 py-1">
            {navigationItems.map((item) => (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                  location.pathname === item.path
                    ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-gray-200 bg-gray-50">
        <div className="px-2 py-2 space-y-1">
          {navigationItems.map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.path)}
              className={`block w-full text-left px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 ${
                location.pathname === item.path
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};

export default Header;