"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { type User, type Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  authDialogOpen: boolean;
  setAuthDialogOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const [supabase] = useState(() => createClient());

  useEffect(() => {
    // Check for auth errors in URL
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("authError")) {
        alert("Login fehlgeschlagen. Grund: " + urlParams.get("authError"));
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    // Initial session fetch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === "SIGNED_IN") {
        setAuthDialogOpen(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);


  const signInWithGoogle = useCallback(async () => {
    // Set a sessionStorage flag so the landing page knows to resume
    // the chat after the OAuth redirect (sessionStorage is cleared
    // when the tab closes, so it won't persist across sessions).
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("etf-finder:resume-after-auth", "1");
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signInWithGoogle, signOut, authDialogOpen, setAuthDialogOpen }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
