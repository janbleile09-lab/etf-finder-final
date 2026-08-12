"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { useBookmarks } from "@/hooks/use-bookmarks";

interface BookmarkButtonProps {
  isin: string;
  name: string;
  initialBookmarked?: boolean;
  className?: string;
}

export function BookmarkButton({
  isin,
  name,
  initialBookmarked = false,
  className,
}: BookmarkButtonProps) {
  const { user, setAuthDialogOpen } = useAuth();
  const { toggleBookmark, isBookmarked: checkBookmarked } = useBookmarks();
  
  // Use the hook's state if we are logged in, otherwise fallback to the prop for static rendering
  const isBookmarked = user ? checkBookmarked(isin) : initialBookmarked;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      setAuthDialogOpen(true);
      return;
    }

    toggleBookmark(isin, name);
  };

  return (
    <motion.span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      whileTap={{ scale: 1.25 }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
      className={cn(
        "relative inline-flex size-8 items-center justify-center rounded-full cursor-pointer",
        "transition-colors duration-150",
        isBookmarked
          ? "text-rose-500 hover:text-rose-600"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
      aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={isBookmarked ? "filled" : "outline"}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        >
          <Heart
            className="size-4"
            fill={isBookmarked ? "currentColor" : "none"}
            fillOpacity={isBookmarked ? 1 : 0}
            strokeWidth={isBookmarked ? 2.5 : 1.75}
          />
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}
