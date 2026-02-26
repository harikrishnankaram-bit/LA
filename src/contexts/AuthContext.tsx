import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  username: string;
  role: "admin" | "employee";
  department: string | null;
  company: string | null;
  phone_number: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

/** Clears any stale Supabase session keys from localStorage */
const clearStaleSession = () => {
  try {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith("sb-") && k.includes("-auth-token")
    );
    keys.forEach((k) => localStorage.removeItem(k));
    console.log("Cleared stale Supabase session from localStorage.");
  } catch (_) {
    // localStorage might not be accessible in some environments
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (data) {
        setProfile(data as Profile);
      } else {
        // Fallback: If no profile row exists, check the Auth Metadata (Standard for Admin)
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser && authUser.user_metadata?.role === "admin") {
          setProfile({
            id: authUser.id,
            user_id: authUser.id,
            full_name: authUser.user_metadata.full_name || "Admin",
            username: authUser.email || "admin",
            role: "admin",
            department: "Admin",
            company: "Vaazhai",
            phone_number: ""
          });
        }
      }
    } catch (err) {
      console.error("UNEXPECTED PROFILE FETCH ERROR:", err);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        // If Supabase returns a network/retryable error, the stored session
        // token is stale or the project is unreachable. Clear it so the user
        // sees the login page instead of an infinite spinner.
        if (error) {
          console.warn("Session fetch error — clearing stale session:", error.message);
          clearStaleSession();
          if (mounted) {
            setUser(null);
            setProfile(null);
          }
          return;
        }

        console.log("SESSION:", session);

        if (session?.user) {
          console.log("USER:", session.user);
          if (mounted) setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          if (mounted) {
            setUser(null);
            setProfile(null);
          }
        }
      } catch (error: any) {
        // Network-level failure (e.g. ERR_QUIC_PROTOCOL_ERROR, ERR_CONNECTION_TIMED_OUT)
        // Treat as "no session" so the user sees the login page, not a frozen spinner
        console.warn("AUTH INIT NETWORK ERROR — showing login page:", error?.message);
        clearStaleSession();
        if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("AUTH STATE CHANGE:", event);

      // TOKEN_REFRESHED_FAILED means the stored token is expired / network is down
      // Sign out cleanly so the user is redirected to login
      if (event === "TOKEN_REFRESHED" && !session) {
        console.warn("Token refresh failed — signing out");
        clearStaleSession();
        if (mounted) {
          setUser(null);
          setProfile(null);
        }
        return;
      }

      if (session?.user) {
        if (mounted) setUser(session.user);
        fetchProfile(session.user.id);
      } else if (event === "SIGNED_OUT") {
        if (mounted) {
          setUser(null);
          setProfile(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    // Determine email from username
    let email: string;
    if (username === "admin@vaazhai" || username === "admin") {
      email = "admin@vaazhai.com";
    } else {
      email = username.trim();
    }

    console.log("LOGIN ATTEMPT:", email);
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    console.log("LOGIN DATA:", authData);

    if (error) {
      console.log("LOGIN ERROR:", error);
      throw error;
    }

    if (authData.user) {
      await fetchProfile(authData.user.id);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearStaleSession();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
