"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  LogOut,
  Loader2,
  User,
  Bookmark,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { SavedEtfsSheet } from "@/components/saved-etfs-sheet";
import { ETFSearch } from "@/components/etf-search";

export function Navbar() {
  const { user, loading, signInWithGoogle, signOut, authDialogOpen, setAuthDialogOpen } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedSheetOpen, setSavedSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  async function handleSignIn() {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setMenuOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          {/* Logo */}
          <a
            href="/"
            className="flex items-center gap-2 text-sm font-medium tracking-tight text-foreground transition-colors hover:text-foreground/70"
          >
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            >
              ETF Finder
            </motion.span>
          </a>

          {/* Right area */}
          <nav className="flex items-center gap-2">
            <button
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-4" />
            </button>

            {/* Auth section */}
            {loading ? (
              <span className="inline-flex size-8 items-center justify-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </span>
            ) : user ? (
              /* ── Signed in: avatar + dropdown ──────────── */
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="inline-flex size-8 items-center justify-center overflow-hidden rounded-full ring-1 ring-border transition-shadow hover:ring-foreground/20"
                  aria-label="User menu"
                >
                  {user.user_metadata?.avatar_url ? (
                    <Image
                      src={user.user_metadata.avatar_url}
                      alt="Avatar"
                      width={32}
                      height={32}
                      className="size-full object-cover"
                    />
                  ) : (
                    <User className="size-3.5 text-muted-foreground" />
                  )}
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <>
                      {/* Click-away backdrop */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -6 }}
                        transition={{
                          type: "spring",
                          bounce: 0,
                          duration: 0.3,
                        }}
                        className="absolute right-0 top-full z-20 mt-1.5 w-48 origin-top-right rounded-xl border border-border bg-popover p-1 shadow-dialog"
                      >
                        <div className="border-b border-border px-3 py-2 mb-1">
                          <p className="text-xs font-medium text-foreground truncate">
                            {user.user_metadata?.full_name ?? user.email}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            setSavedSheetOpen(true);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98]"
                        >
                          <Bookmark className="size-3.5" />
                          Saved ETFs
                        </button>
                        <button
                          onClick={handleSignOut}
                          className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98]"
                        >
                          <LogOut className="size-3.5" />
                          Sign out
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              /* ── Signed out: sign-in button ────────────── */
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSignIn}
                disabled={signingIn}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60 active:scale-[0.98]"
              >
                {signingIn ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      className="size-3.5"
                      aria-hidden="true"
                    >
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
                        fill="#EA4335"
                      />
                    </svg>
                    Sign in with Google
                  </>
                )}
              </motion.button>
            )}
          </nav>
        </div>
      </header>

      {/* Auth dialog for unauthenticated bookmark attempts */}
      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
      />

      {/* ETF Search Dialog */}
      <ETFSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Slide-over sheet for saved ETFs */}
      {user && (
        <SavedEtfsSheet 
          open={savedSheetOpen} 
          onOpenChange={setSavedSheetOpen} 
        />
      )}
    </>
  );
}
