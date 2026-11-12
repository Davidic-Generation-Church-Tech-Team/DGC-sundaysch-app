import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "onboardingCompleted";
const DARK_MODE_KEY = "darkMode";

// App-wide settings (theme + first-run state). Despite the name it does not
// navigate — screens decide where to go next; see app/index.tsx.
interface NavigationContextType {
  isDarkMode: boolean;
  setIsDarkMode: (mode: boolean) => void;
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (completed: boolean) => Promise<void>;
  isLoading: boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setDarkMode] = useState(false);
  const [hasCompletedOnboarding, setOnboardingCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [onboarding, dark] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem(DARK_MODE_KEY),
        ]);
        setOnboardingCompleted(onboarding === "true");
        setDarkMode(dark === "true");
      } catch (error) {
        console.error("Error loading app settings:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setIsDarkMode = useCallback((mode: boolean) => {
    setDarkMode(mode);
    AsyncStorage.setItem(DARK_MODE_KEY, String(mode)).catch((error) =>
      console.error("Error saving theme:", error)
    );
  }, []);

  const setHasCompletedOnboarding = useCallback(async (completed: boolean) => {
    setOnboardingCompleted(completed);
    try {
      if (completed) await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      else await AsyncStorage.removeItem(ONBOARDING_KEY);
    } catch (error) {
      console.error("Error saving onboarding status:", error);
    }
  }, []);

  const value = useMemo(
    () => ({ isDarkMode, setIsDarkMode, hasCompletedOnboarding, setHasCompletedOnboarding, isLoading }),
    [isDarkMode, setIsDarkMode, hasCompletedOnboarding, setHasCompletedOnboarding, isLoading]
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) throw new Error("useNavigation must be used within NavigationProvider");
  return context;
}
