"use client";

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { showError } from '@/utils/toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
      } else {
        setSession(null);
        setUser(null);
      }
      setIsLoading(false);

      if (event === 'SIGNED_OUT') {
        // Clear local storage items related to onboarding or user state if necessary
        localStorage.removeItem("onboarding_skipped");
        console.log("User signed out. Local storage cleared.");
      }
    });

    // Initial session check
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (error) {
        console.error("Error getting initial session:", error);
        showError("Failed to load session: " + error.message);
      }
      if (initialSession) {
        setSession(initialSession);
        setUser(initialSession.user);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};