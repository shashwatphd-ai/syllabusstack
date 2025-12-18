import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface AuthGuardProps {
  children: ReactNode;
  requireOnboarding?: boolean;
}

// Mock auth state - will be replaced with real auth when Lovable Cloud is enabled
const useAuth = () => {
  // TODO: Replace with actual Supabase auth
  return {
    user: null, // Set to mock user for development
    isLoading: false,
    isOnboarded: false,
  };
};

export function AuthGuard({ children, requireOnboarding = false }: AuthGuardProps) {
  const { user, isLoading, isOnboarded } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // For development, allow access without auth
  // In production, uncomment the redirect logic below
  
  /*
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireOnboarding && !isOnboarded) {
    return <Navigate to="/onboarding" replace />;
  }
  */

  return <>{children}</>;
}

// Redirect authenticated users away from auth pages
export function GuestGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // For development, show auth pages
  // In production, redirect to dashboard if already logged in
  
  /*
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  */

  return <>{children}</>;
}
