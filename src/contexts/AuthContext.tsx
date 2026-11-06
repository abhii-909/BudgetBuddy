import * as Linking from "expo-linking";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { router } from "expo-router";

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
  isPasswordRecovery: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (
    fullName: string,
    email: string,
    password: string
  ) => Promise<{
    error: string | null;
    isDuplicate?: boolean;
    needsConfirmation?: boolean;
  }>;
  logout: () => Promise<{ error: string | null }>;
  updateDisplayName: (name: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  clearPasswordRecovery: () => void;
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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  /**
   * Ensures a user has a corresponding row in the public.profiles table.
   * Runs only when an authenticated session is established, so (auth.uid() = id) RLS passes safely.
   */
  const ensureProfile = async (targetUser: User): Promise<ProfileData> => {
    try {
      const { data: existing, error: selectError } = await supabase
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("id", targetUser.id)
        .maybeSingle();

      if (selectError) {
        console.error("[AuthContext] Error checking profile row:", selectError.message);
      }

      if (existing) {
        return existing;
      }

      // Profile does not exist yet: create it securely as the authenticated user
      const fullName =
        targetUser.user_metadata?.full_name ||
        targetUser.email?.split("@")[0] ||
        "User";
      const email = targetUser.email || "";

      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: targetUser.id,
          full_name: fullName,
          email: email,
          avatar_url: null
        })
        .select("full_name, email, avatar_url")
        .maybeSingle();

      if (insertError) {
        console.error("[AuthContext] Failed to insert profile row:", insertError.message);
        return null;
      }

      console.log("[AuthContext] ✅ Profile row created successfully for authenticated user:", targetUser.id);
      return inserted;
    } catch (err) {
      console.error("[AuthContext] Unexpected error in ensureProfile:", err);
      return null;
    }
  };

  const refreshProfile = useCallback(async (userId?: string) => {
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
      console.error("[AuthContext] Error refreshing profile:", err);
    }
  }, [user?.id]);

  /**
   * Parses and exchanges tokens or PKCE auth codes from incoming deep links
   */
  const handleDeepLinkUrl = async (url: string | null) => {
    if (!url) return;

    console.log("[AuthContext] Received incoming deep link:", url);

    try {
      // 1. Check for PKCE code in query string (e.g. ?code=...)
      if (url.includes("code=")) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) {
          console.error("[AuthContext] exchangeCodeForSession failed:", error.message);
        } else if (data.session) {
          console.log("[AuthContext] ✅ Successfully exchanged code for session");
          setSession(data.session);
          setUser(data.session.user);
          const p = await ensureProfile(data.session.user);
          if (p) setProfile(p);
        }
        return;
      }

      // 2. Check for hash fragment tokens (access_token & refresh_token)
      if (url.includes("access_token=") && url.includes("refresh_token=")) {
        // Parse params after # or ?
        const fragment = url.includes("#") ? url.split("#")[1] : url.split("?")[1];
        const params = new URLSearchParams(fragment);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            console.error("[AuthContext] setSession from deep link failed:", error.message);
          } else if (data.session) {
            console.log("[AuthContext] ✅ Successfully set session from deep link. Type:", type);
            setSession(data.session);
            setUser(data.session.user);

            if (type === "recovery") {
              setIsPasswordRecovery(true);
              router.replace("/reset-password");
              return;
            }

            const p = await ensureProfile(data.session.user);
            if (p) setProfile(p);
            router.replace("/(tabs)/dashboard");
          }
        }
      }
    } catch (err) {
      console.error("[AuthContext] Error processing deep link URL:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const totalStart = Date.now();
      const sessionStart = Date.now();
      const { session: existingSession } = await getSession();
      console.log(`[BudgetBuddy] Session Restoration took: ${Date.now() - sessionStart}ms`);

      if (!isMounted) return;

      if (existingSession) {
        // Verify with the Supabase auth server whether this user still actually exists in the database
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError || !userData?.user) {
          console.warn("[AuthContext] Stored session belongs to deleted user. Logging out...");
          await supabase.auth.signOut();
          if (isMounted) {
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        setSession(existingSession);
        setUser(userData.user);
      } else {
        setSession(null);
        setUser(null);
      }

      setLoading(false);
      console.log(`[BudgetBuddy] Total Auth & Session Restoration took: ${Date.now() - totalStart}ms`);
    };

    loadSession();

    // Check if app was opened via deep link
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && isMounted) {
        handleDeepLinkUrl(initialUrl);
      }
    });

    // Listen for incoming deep links while app is open / foregrounded
    const linkingSub = Linking.addEventListener("url", (event) => {
      if (isMounted) {
        handleDeepLinkUrl(event.url);
      }
    });

    // Supabase auth state change listener
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      console.log("[AuthContext] onAuthStateChange event:", event);

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);

      if (event === "PASSWORD_RECOVERY") {
        console.log("[AuthContext] PASSWORD_RECOVERY event received!");
        setIsPasswordRecovery(true);
        router.replace("/reset-password");
        return;
      }

      if (newSession?.user) {
        const p = await ensureProfile(newSession.user);
        if (isMounted && p) {
          setProfile(p);
        }
      } else {
        if (isMounted) setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      linkingSub.remove();
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const syncProfile = async () => {
      if (user) {
        // Double-check with Supabase auth server: if user was deleted remotely, sign out
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          console.warn("[AuthContext] User no longer exists in auth.users. Logging out...");
          await supabase.auth.signOut();
          if (isMounted) {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
          return;
        }

        const profileStart = Date.now();
        const p = await ensureProfile(user);
        if (isMounted) {
          if (p) setProfile(p);
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
        const p = await ensureProfile(data.user);
        if (p) setProfile(p);
      }
    }

    return { error };
  };

  const signup = async (fullName: string, email: string, password: string) => {
    const result = await signUp({ fullName, email, password });

    if (!result.error && result.data?.session) {
      setSession(result.data.session);
      setUser(result.data.user);
      if (result.data.user) {
        const p = await ensureProfile(result.data.user);
        if (p) setProfile(p);
      }
    }

    return {
      error: result.error,
      isDuplicate: result.isDuplicate,
      needsConfirmation: result.needsConfirmation
    };
  };

  const logout = async () => {
    const { error } = await signOut();

    if (!error) {
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsPasswordRecovery(false);
    }

    return { error };
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
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
      isPasswordRecovery,
      login,
      signup,
      logout,
      updateDisplayName,
      clearPasswordRecovery,
      refreshProfile: async () => {
        if (user?.id) await refreshProfile(user.id);
      }
    }),
    [user, profile, session, loading, isPasswordRecovery, refreshProfile]
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
