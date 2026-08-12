"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Heart, X } from "lucide-react";

interface ToastProps {
  message: string | null;
  type?: "saved" | "removed";
  onDismiss: () => void;
}

export function Toast({ message, type = "saved", onDismiss }: ToastProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-xl border border-border bg-popover px-4 py-2.5 text-sm shadow-dialog"
        >
          <Heart
            className="size-4 shrink-0 text-rose-500"
            fill="currentColor"
            fillOpacity={type === "saved" ? 1 : 0}
          />
          <span className="text-foreground">{message}</span>
          <button
            onClick={onDismiss}
            className="ml-1 inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
