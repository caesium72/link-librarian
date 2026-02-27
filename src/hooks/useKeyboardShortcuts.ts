import { useEffect, useCallback } from "react";

interface KeyboardShortcutsOptions {
  onFocusSearch?: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onOpenLink?: () => void;
  onCloseDetail?: () => void;
  onToggleView?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onFocusSearch,
  onNavigateUp,
  onNavigateDown,
  onOpenLink,
  onCloseDetail,
  onToggleView,
  enabled = true,
}: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (e.key === "Escape") {
        onCloseDetail?.();
        // Also blur any focused input
        if (isInput) (target as HTMLInputElement).blur();
        return;
      }

      if (isInput) return;

      if (e.key === "/") {
        e.preventDefault();
        onFocusSearch?.();
      } else if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        onNavigateDown?.();
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        onNavigateUp?.();
      } else if (e.key === "o" || e.key === "Enter") {
        e.preventDefault();
        onOpenLink?.();
      } else if (e.key === "v") {
        e.preventDefault();
        onToggleView?.();
      }
    },
    [enabled, onFocusSearch, onNavigateUp, onNavigateDown, onOpenLink, onCloseDetail, onToggleView]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
