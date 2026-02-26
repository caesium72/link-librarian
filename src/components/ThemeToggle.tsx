import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useCallback } from "react";

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === "dark" ? "light" : "dark";

    // If View Transition API is supported, use it for a smooth crossfade
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        setTheme(nextTheme);
      });
    } else {
      // Fallback: add a brief opacity transition on the root
      document.documentElement.style.transition = "background-color 0.4s ease, color 0.4s ease";
      setTheme(nextTheme);
      setTimeout(() => {
        document.documentElement.style.transition = "";
      }, 500);
    }
  }, [theme, setTheme]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 relative overflow-hidden"
      onClick={toggleTheme}
    >
      <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-all duration-500 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-all duration-500 dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
};
