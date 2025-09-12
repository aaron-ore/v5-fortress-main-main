"use client";

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { showError } from '@/utils/toast';
import { logActivity } from '@/utils/logActivity'; // NEW: Import logActivity
import { useProfile } from './ProfileContext'; // NEW: Import useProfile

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
  const { profile } = useProfile(); // NEW: Get current profile for logging

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
        localStorage.removeItem("onboarding_skipped");
        console.log("User signed out. Local storage cleared.");
        await logActivity("Logout Success", `User ${user?.email || 'unknown'} signed out.`, profile);
      }
    });

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: initialSession }, error }) => {
      if (error) {
        console.error("Error getting initial session:", error);
        showError("Failed to load session: " + error.message);
        await logActivity("Session Load Failed", `Failed to load initial session.`, profile, { error_message: error.message }, true);
      }
      if (initialSession) {
        setSession(initialSession);
        setUser(initialSession.user);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [profile]); // Added profile to dependency array

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