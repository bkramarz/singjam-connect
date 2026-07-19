import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

type LiteProfile = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type AuthContextValue = {
  session: Session | null;
  initialised: boolean;
  profileComplete: boolean | null;
  profile: LiteProfile | null;
  isGuest: boolean;
  continueAsGuest: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialised, setInitialised] = useState(false);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<LiteProfile | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    async function loadProfile(userId: string) {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, username, avatar_url')
        .eq('id', userId)
        .single();
      setProfile(data ?? null);
      setProfileComplete(!!data?.display_name);
    }

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) await loadProfile(session.user.id);
      setInitialised(true);
    }
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) setIsGuest(false);
      if (!session) {
        setProfileComplete(null);
        setProfile(null);
        return;
      }
      loadProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, initialised, profileComplete, profile, isGuest, continueAsGuest: () => setIsGuest(true) }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
