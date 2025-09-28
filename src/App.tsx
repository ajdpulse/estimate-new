import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import './lib/i18n';

// Components
import Header from './components/common/Header';
import LoadingSpinner from './components/common/LoadingSpinner';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Works from './components/Works';
import Subworks from './components/Subworks';
import Compare from './components/Compare';
import GenerateEstimate from './components/generate-estimate/GenerateEstimate';
import MeasurementBook from './components/MeasurementBook';

// Protected Route Wrapper
import ProtectedRoute from './components/common/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              
              {/* Protected Routes */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div className="flex flex-col min-h-screen">
                      <Header />
                      <main className="flex-1 max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 w-full">
                        <Dashboard />
                      </main>
                    </div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/works"
                element={
                  <ProtectedRoute>
                    <div className="flex flex-col min-h-screen">
                      <Header />
                      <main className="flex-1 max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 w-full">
                        <Works />
                      </main>
                    </div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subworks"
                element={
                  <ProtectedRoute>
                    <div className="flex flex-col min-h-screen">
                      <Header />
                      <main className="flex-1 max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 w-full">
                        <Subworks />
                      </main>
                    </div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/generate-estimate"
                element={
                  <ProtectedRoute>
                    <div className="flex flex-col min-h-screen">
                      <Header />
                      <main className="flex-1 max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 w-full">
                        <GenerateEstimate />
                      </main>
                    </div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/compare"
                element={
                  <ProtectedRoute>
                    <div className="flex flex-col min-h-screen">
                      <Header />
                      <main className="flex-1 max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 w-full">
                        <Compare />
                      </main>
                    </div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/measurement-book"
                element={
                  <ProtectedRoute>
                    <div className="flex flex-col min-h-screen">
                      <Header />
                      <main className="flex-1 max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 w-full">
                        <MeasurementBook />
                      </main>
                    </div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </div>
        </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;