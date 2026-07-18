import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

type AuthContextValue = {
  session: Session | null;
  initialised: boolean;
  profileComplete: boolean | null;
  isGuest: boolean;
  continueAsGuest: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialised, setInitialised] = useState(false);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) {
        const { data } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', session.user.id)
          .single();
        setProfileComplete(!!data?.display_name);
      }
      setInitialised(true);
    }
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) setIsGuest(false);
      if (!session) {
        setProfileComplete(null);
        return;
      }
      supabase
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => setProfileComplete(!!data?.display_name));
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, initialised, profileComplete, isGuest, continueAsGuest: () => setIsGuest(true) }}
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
