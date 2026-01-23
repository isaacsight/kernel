/**
 * MDLS Theme Context
 * Sovereign Laboratory OS - Design Mode Switching
 *
 * Provides React context for switching between Arcade and Rubin modes.
 * Handles localStorage persistence, system preference detection, and
 * route-based automatic switching.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

// ============================================
// Types
// ============================================

export type DesignMode = 'arcade' | 'rubin';

interface ThemeContextValue {
  /** Current active design mode */
  mode: DesignMode;
  /** Toggle between arcade and rubin modes */
  toggleMode: () => void;
  /** Set a specific mode */
  setMode: (mode: DesignMode) => void;
  /** Whether mode is determined by route */
  isRouteControlled: boolean;
  /** Enable/disable route-based mode switching */
  setRouteControlled: (enabled: boolean) => void;
}

interface ThemeProviderProps {
  children: ReactNode;
  /** Default mode if no preference is stored */
  defaultMode?: DesignMode;
  /** Routes that should use Rubin mode */
  rubinRoutes?: string[];
  /** Storage key for persisting preference */
  storageKey?: string;
}

// ============================================
// Context
// ============================================

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ============================================
// Constants
// ============================================

const DEFAULT_STORAGE_KEY = 'mdls-design-mode';
const DEFAULT_RUBIN_ROUTES = [
  '/essays',
  '/writing',
  '/philosophy',
  '/about',
  '/manifesto',
];

// ============================================
// Provider Component
// ============================================

export function ThemeProvider({
  children,
  defaultMode = 'arcade',
  rubinRoutes = DEFAULT_RUBIN_ROUTES,
  storageKey = DEFAULT_STORAGE_KEY,
}: ThemeProviderProps) {
  const [mode, setModeState] = useState<DesignMode>(defaultMode);
  const [isRouteControlled, setRouteControlled] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // ----------------------------------------
  // Initialize from storage on mount
  // ----------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'arcade' || stored === 'rubin') {
        setModeState(stored);
      }
    } catch (e) {
      // localStorage may be unavailable
      console.warn('MDLS: Unable to read from localStorage', e);
    }

    setIsInitialized(true);
  }, [storageKey]);

  // ----------------------------------------
  // Route-based mode detection
  // ----------------------------------------
  useEffect(() => {
    if (!isRouteControlled || typeof window === 'undefined') return;

    const checkRoute = () => {
      const path = window.location.pathname;
      const shouldBeRubin = rubinRoutes.some(
        (route) => path === route || path.startsWith(route + '/')
      );
      setModeState(shouldBeRubin ? 'rubin' : 'arcade');
    };

    // Check on mount
    checkRoute();

    // Listen for navigation changes (for SPA routing)
    window.addEventListener('popstate', checkRoute);

    return () => {
      window.removeEventListener('popstate', checkRoute);
    };
  }, [isRouteControlled, rubinRoutes]);

  // ----------------------------------------
  // Apply mode to document
  // ----------------------------------------
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Set data attribute on body
    document.body.setAttribute('data-mode', mode);

    // Also set on html element for full cascade
    document.documentElement.setAttribute('data-mode', mode);

    // Update meta theme-color for mobile browsers
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute(
        'content',
        mode === 'arcade' ? '#020202' : '#FAF9F6'
      );
    }
  }, [mode]);

  // ----------------------------------------
  // Mode setters
  // ----------------------------------------
  const setMode = useCallback(
    (newMode: DesignMode) => {
      setModeState(newMode);

      // Persist to storage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, newMode);
        } catch (e) {
          console.warn('MDLS: Unable to write to localStorage', e);
        }
      }

      // Disable route control when manually set
      setRouteControlled(false);
    },
    [storageKey]
  );

  const toggleMode = useCallback(() => {
    setMode(mode === 'arcade' ? 'rubin' : 'arcade');
  }, [mode, setMode]);

  // ----------------------------------------
  // Context value
  // ----------------------------------------
  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      toggleMode,
      setMode,
      isRouteControlled,
      setRouteControlled,
    }),
    [mode, toggleMode, setMode, isRouteControlled]
  );

  // Prevent flash of wrong theme
  if (!isInitialized && typeof window !== 'undefined') {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}

// ============================================
// Utility Hook: Mode-specific values
// ============================================

export function useModeValue<T>(arcadeValue: T, rubinValue: T): T {
  const { mode } = useTheme();
  return mode === 'arcade' ? arcadeValue : rubinValue;
}

// ============================================
// Utility Component: Mode-specific rendering
// ============================================

interface ModeOnlyProps {
  mode: DesignMode;
  children: ReactNode;
}

export function ModeOnly({ mode: targetMode, children }: ModeOnlyProps) {
  const { mode } = useTheme();
  return mode === targetMode ? <>{children}</> : null;
}

// ============================================
// SSR Helper: Inline script to prevent flash
// ============================================

export const ThemeScript = `
(function() {
  try {
    var mode = localStorage.getItem('${DEFAULT_STORAGE_KEY}');
    if (mode === 'arcade' || mode === 'rubin') {
      document.documentElement.setAttribute('data-mode', mode);
      document.body.setAttribute('data-mode', mode);
    }
  } catch (e) {}
})();
`;

// ============================================
// Example Usage
// ============================================

/*
// In your root layout/App:

import { ThemeProvider } from './styles/theme-context';
import './styles/mdls-generated.css';

function App() {
  return (
    <ThemeProvider
      defaultMode="arcade"
      rubinRoutes={['/essays', '/writing', '/about']}
    >
      <YourRoutes />
    </ThemeProvider>
  );
}

// In components:

import { useTheme, useModeValue, ModeOnly } from './styles/theme-context';

function Header() {
  const { mode, toggleMode } = useTheme();

  // Use different logos per mode
  const logo = useModeValue('/logo-arcade.svg', '/logo-rubin.svg');

  return (
    <header>
      <img src={logo} alt="Logo" />
      <button onClick={toggleMode}>
        Switch to {mode === 'arcade' ? 'Rubin' : 'Arcade'} Mode
      </button>

      <ModeOnly mode="arcade">
        <span>Arcade-only content here</span>
      </ModeOnly>
    </header>
  );
}

// For SSR (Next.js, Remix, etc.), add to <head>:

<script dangerouslySetInnerHTML={{ __html: ThemeScript }} />
*/

export default ThemeProvider;
