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
  joining_date: string | null;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    console.log("FETCHING PROFILE FOR:", userId);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("PROFILE FETCH ERROR:", error);
      } else if (data) {
        console.log("PROFILE FETCHED:", data);
        console.log("ROLE:", data.role);
        setProfile(data as Profile);
      }
    } catch (err) {
      console.error("UNEXPECTED PROFILE FETCH ERROR:", err);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log("SESSION:", session);

        if (session?.user) {
          console.log("USER:", session.user);
          setUser(session.user);
          // Await profile fetch before setting loading to false
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error("AUTH INIT ERROR:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("AUTH STATE CHANGE:", event);
      if (session?.user) {
        setUser(session.user);
        // If profile is missing or mismatched (e.g. account switch), fetch it
        // Note: We don't block here as this is an event listener, but signIn awaits it manually below
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
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
    if (username === "admin@vaazhai") {
      email = "admin@vaazhai.com";
    } else {
      email = `${username.replace(/[^a-zA-Z0-9]/g, '')}@vaazhai.emp`;
    }

    console.log("LOGIN ATTEMPT:", email);
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    console.log("LOGIN DATA:", authData);

    if (error) {
      console.log("LOGIN ERROR:", error);
      throw error;
    }

    if (authData.user) {
      // Ensure profile is fetched before resolving signIn
      await fetchProfile(authData.user.id);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
