import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

if (typeof global !== "undefined" && !(global as any).startupStartTime) {
  (global as any).startupStartTime = Date.now();
  console.log("[BudgetBuddy] App Startup Timer Started");
}
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  getSession,
  signIn,
  signOut,
  signUp
} from "../services/authService";

type ProfileData = {
  full_name: string;
  email: string;
  avatar_url: string | null;
} | null;

type AuthContextValue = {
  user: User | null;
  profile: ProfileData;
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
  refreshProfile: () => Promise<void>;
};

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async (userId?: string) => {
    const targetId = userId || user?.id;
    if (!targetId) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("id", targetId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfile(data);
      }
    } catch (err) {
      console.error("Error refreshing profile in AuthContext:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const totalStart = Date.now();
      const sessionStart = Date.now();
      const { session: existingSession } = await getSession();
      console.log(`[BudgetBuddy] Session Restoration took: ${Date.now() - sessionStart}ms`);

      if (!isMounted) {
        return;
      }

      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
      console.log(`[BudgetBuddy] Total Auth & Session Restoration took: ${Date.now() - totalStart}ms`);
    };

    loadSession();

    // Supabase calls this whenever the user signs in, signs out, or refreshes.
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const syncProfile = async () => {
      if (user) {
        const profileStart = Date.now();
        await refreshProfile(user.id);
        if (isMounted) {
          console.log(`[BudgetBuddy] Profile Fetch took: ${Date.now() - profileStart}ms`);
        }
      } else {
        setProfile(null);
      }
    };

    syncProfile();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const login = async (email: string, password: string) => {
    const { data, error } = await signIn({ email, password });

    if (!error && data) {
      setSession(data.session);
      setUser(data.user);
      if (data.user) {
        await refreshProfile(data.user.id);
      }
    }

    return { error };
  };

  const signup = async (fullName: string, email: string, password: string) => {
    const { data, error } = await signUp({ fullName, email, password });

    if (!error && data?.session) {
      setSession(data.session);
      setUser(data.user);
      if (data.user) {
        await refreshProfile(data.user.id);
      }
    }

    return { error };
  };

  const logout = async () => {
    const { error } = await signOut();

    if (!error) {
      setSession(null);
      setUser(null);
      setProfile(null);
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
        await refreshProfile(data.user.id);
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
      profile,
      session,
      loading,
      login,
      signup,
      logout,
      updateDisplayName,
      refreshProfile: async () => {
        if (user?.id) await refreshProfile(user.id);
      }
    }),
    [user, profile, session, loading]
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
