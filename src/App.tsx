import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Login from './pages/Login';
import DashboardHome from './pages/DashboardHome';
import Classes from './pages/Classes';
import Students from './pages/Students';
import StudentDetails from './pages/StudentDetails';
import Subjects from './pages/Subjects';
import ObjectiveTests from './pages/ObjectiveTests';
import Homework from './pages/Homework';
import Assignments from './pages/Assignments';
import LiveClasses from './pages/LiveClasses';
import RecordedClasses from './pages/RecordedClasses';
import HeroBanners from './pages/HeroBanners';
import Notifications from './pages/Notifications';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public route */}
              <Route path="/login" element={<Login />} />

              {/* Protected dashboard routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <DashboardHome />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/classes"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Classes />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/students"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Students />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/students/:id"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <StudentDetails />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subjects"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Subjects />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tests"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <ObjectiveTests />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/homework"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Homework />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assignments"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Assignments />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/live-classes"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <LiveClasses />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recorded-classes"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <RecordedClasses />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/banners"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <HeroBanners />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Notifications />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Analytics />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <Settings />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />

              {/* Catch-all redirect to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
