import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Skeleton from './ui/Skeleton';
import { ShieldAlert, LogOut } from 'lucide-react';
import Button from './ui/Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, isAdmin, error, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    console.log("[Route] ProtectedRoute: Auth state is loading...");
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 space-y-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (!user) {
    console.log("[Route] ProtectedRoute: No user authenticated. Route decision: REDIRECT TO /login");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isAdmin === false) {
    console.log(`[Route] ProtectedRoute: User ${user.email} is NOT an admin. Route decision: SHOW ACCESS DENIED`);
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="max-w-md w-full bg-card border border-destructive/20 rounded-2xl p-8 shadow-xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-destructive animate-pulse" />
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-6">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            Access Denied
          </h1>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            {error || "Your account is not authorized to access this administration dashboard. Only registered administrators are permitted."}
          </p>
          <div className="flex flex-col gap-3">
            <div className="text-xs text-muted-foreground bg-secondary/50 py-2 px-3 rounded-lg border border-border">
              Logged in as: <span className="font-medium text-foreground">{user.email}</span>
            </div>
            <Button
              variant="destructive"
              onClick={() => logout()}
              className="w-full flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign Out & Try Another Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  console.log(`[Route] ProtectedRoute: User ${user.email} is authorized. Route decision: RENDER COMPONENT`);
  return <>{children}</>;
};

export default ProtectedRoute;
