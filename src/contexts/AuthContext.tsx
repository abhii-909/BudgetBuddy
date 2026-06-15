import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  getSession,
  signIn,
  signOut,
  signUp
} from "../services/authService";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (
    fullName: string,
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
  logout: () => Promise<{ error: string | null }>;
  updateDisplayName: (name: string) => Promise<{ error: string | null }>;
};


type AuthProviderProps = {
  children: ReactNode;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const { session: existingSession } = await getSession();
      console.log("RESTORED SESSION:", existingSession);

      if (!isMounted) {
        return;
      }

      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    };

    loadSession();

    // Supabase calls this whenever the user signs in, signs out, or refreshes.
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("AUTH STATE CHANGED:", event);
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await signIn({ email, password });

    if (!error && data) {
      setSession(data.session);
      setUser(data.user);
    }

    return { error };
  };

  const signup = async (fullName: string, email: string, password: string) => {
    const { data, error } = await signUp({ fullName, email, password });

    if (!error && data?.session) {
      setSession(data.session);
      setUser(data.user);
    }

    return { error };
  };

  const logout = async () => {
    const { error } = await signOut();

    if (!error) {
      setSession(null);
      setUser(null);
    }

    return { error };
  };

  const updateDisplayName = async (name: string) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: name }
      });
      if (error) throw error;
      if (data?.user) {
        setUser(data.user);
      }
      return { error: null };
    } catch (err: any) {
      console.error("Error in updateDisplayName context:", err);
      return { error: err.message || "Failed to update display name." };
    }
  };

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      login,
      signup,
      logout,
      updateDisplayName
    }),
    [user, session, loading]
  );


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }

  return context;
}
