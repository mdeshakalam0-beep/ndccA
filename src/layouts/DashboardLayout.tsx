import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  FileCheck, 
  Image as ImageIcon, 
  Bell, 
  BarChart3, 
  Settings as SettingsIcon, 
  LogOut, 
  ChevronLeft, 
  ChevronRight, 
  Sun, 
  Moon,
  WifiOff,
  Menu,
  X,
  GraduationCap,
  ClipboardList,
  FileSignature,
  Video,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('ndcc-sidebar-collapsed') === 'true';
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('ndcc-sidebar-collapsed', String(next));
      return next;
    });
  };

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Classes', path: '/classes', icon: GraduationCap },
    { name: 'Students', path: '/students', icon: Users },
    { name: 'Subjects', path: '/subjects', icon: BookOpen },
    { name: 'Objective Tests', path: '/tests', icon: FileCheck },
    { name: 'Homework', path: '/homework', icon: ClipboardList },
    { name: 'Assignments', path: '/assignments', icon: FileSignature },
    { name: 'Live Classes', path: '/live-classes', icon: Video },
    { name: 'Recorded Classes', path: '/recorded-classes', icon: Play },
    { name: 'Hero Banner', path: '/banners', icon: ImageIcon },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row transition-colors">
      
      {/* Offline Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground text-xs font-semibold py-2 px-4 flex items-center justify-center gap-2 select-none"
          >
            <WifiOff className="h-3.5 w-3.5 animate-pulse" />
            <span>You are currently offline. Actions might not sync in real-time until reconnected.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 bg-card border-r border-border/80 transition-all duration-300 relative ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Header Branding */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-border/40 select-none">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-400 text-sm whitespace-nowrap"
            >
              NDCC ADMIN
            </motion.div>
          )}
          {isCollapsed && (
            <span className="font-extrabold text-primary text-xs mx-auto">NDCC</span>
          )}
          <button
            onClick={toggleSidebar}
            className="absolute top-5 -right-3 h-6 w-6 rounded-full border border-border bg-card flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer shadow-sm"
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Menu Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all group relative cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
                {isCollapsed && (
                  <div className="absolute left-16 bg-popover border border-border text-xs px-2 py-1 rounded shadow-md hidden group-hover:block whitespace-nowrap z-50">
                    {item.name}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer controls & profile */}
        <div className="p-3 border-t border-border/40 flex flex-col gap-2.5">
          {/* Theme Switch & Sign Out */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              className="flex-1 h-9 rounded-lg hover:bg-secondary border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 h-9 rounded-lg hover:bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Profile Card */}
          {!isCollapsed && user && (
            <div className="bg-secondary/40 border border-border/40 rounded-xl p-3 flex items-center gap-2.5 overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Admin" className="h-8 w-8 rounded-full border border-border" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs select-none">
                  {user.email?.charAt(0).toUpperCase() || 'A'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate leading-tight">
                  {user.displayName || 'NDCC Admin'}
                </p>
                <p className="text-[10px] text-muted-foreground truncate leading-tight">
                  {user.email}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden bg-card border-b border-border/80 h-14 px-4 flex items-center justify-between z-10">
        <Link to="/" className="font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-400 text-sm">
          NDCC ADMIN
        </Link>
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className="h-8 w-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="h-8 w-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Slide-Over */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black md:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-72 bg-card border-l border-border flex flex-col md:hidden"
            >
              <div className="h-14 px-4 flex items-center justify-between border-b border-border/40 select-none">
                <span className="font-semibold text-xs text-muted-foreground">Navigation</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="h-8 w-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
              <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5 shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-border/40 flex flex-col gap-3">
                {user && (
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Admin" className="h-8 w-8 rounded-full border border-border" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs select-none">
                        {user.email?.charAt(0).toUpperCase() || 'A'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate leading-tight">
                        {user.displayName || 'NDCC Admin'}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate leading-tight">
                        {user.email}
                      </p>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full h-10 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main View Container */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto pb-20 md:pb-8">
          {children}
        </div>

        {/* Bottom Nav on Mobile Devices */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-md border-t border-border/60 h-14 flex items-center justify-around px-2 z-35 select-none shadow-lg">
          {menuItems.slice(0, 5).map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-lg cursor-pointer ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
                title={item.name}
              >
                <Icon className="h-4.5 w-4.5" />
                <span className="text-[9px] font-medium leading-none tracking-tight">{item.name.split(' ')[0]}</span>
              </Link>
            );
          })}
          {/* Settings mobile option */}
          <Link
            to="/settings"
            className={`flex flex-col items-center justify-center gap-0.5 w-12 h-12 rounded-lg cursor-pointer ${
              location.pathname === '/settings' ? 'text-primary' : 'text-muted-foreground'
            }`}
            title="Settings"
          >
            <SettingsIcon className="h-4.5 w-4.5" />
            <span className="text-[9px] font-medium leading-none tracking-tight">Settings</span>
          </Link>
        </nav>
      </main>
    </div>
  );
};

export default DashboardLayout;
