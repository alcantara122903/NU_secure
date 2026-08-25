import {
  authService,
  AuthError,
  getDashboardRouteForRole,
  mapLaravelUser,
} from '@/services/authentication';
import { authSessionService } from '@/services/auth-session';
import { secureAuthStorage } from '@/services/storage/secure-auth';
import type { DashboardRoute, User, UserProfile } from '@/types/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type AuthContextValue = {
  isRestoring: boolean;
  isAuthenticated: boolean;
  user: User | null;
  userProfile: UserProfile | null;
  dashboardRoute: DashboardRoute | null;
  login: (email: string, password: string) => Promise<DashboardRoute>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [isRestoring, setIsRestoring] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const loginInFlight = useRef<Promise<DashboardRoute> | null>(null);

  const applySession = useCallback((token: string, nextUser: User, profile: UserProfile) => {
    authSessionService.setSession({
      token,
      user: nextUser,
      userProfile: profile,
    });
    setUser(nextUser);
    setUserProfile(profile);
    setIsAuthenticated(true);
  }, []);

  const clearLocalAuth = useCallback(async () => {
    authSessionService.clearSession();
    await secureAuthStorage.clearSession();
    setUser(null);
    setUserProfile(null);
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const stored = await secureAuthStorage.loadSession();
        if (!stored?.token) {
          return;
        }

        authSessionService.setSession({
          token: stored.token,
          user: stored.userProfile
            ? mapLaravelUser({
                user_id: stored.userProfile.user_id,
                first_name: stored.userProfile.first_name,
                last_name: stored.userProfile.last_name,
                email: stored.userProfile.email,
                role_id: stored.userProfile.role_id,
                status: stored.userProfile.status,
              }).user
            : { id: '', email: '', name: '' },
          userProfile: stored.userProfile ?? undefined,
        });

        try {
          const verified = await authService.getCurrentUser(
            stored.userProfile
              ? {
                  user_id: stored.userProfile.user_id,
                  first_name: stored.userProfile.first_name,
                  last_name: stored.userProfile.last_name,
                  email: stored.userProfile.email,
                  role_id: stored.userProfile.role_id,
                  status: stored.userProfile.status,
                }
              : undefined,
          );
          if (cancelled) {
            return;
          }

          if (verified.role_id === 1) {
            await authService.logout();
            await clearLocalAuth();
            return;
          }

          const mapped = mapLaravelUser(verified);
          applySession(stored.token, mapped.user, mapped.userProfile);
          await secureAuthStorage.saveSession(stored.token, mapped.userProfile);
        } catch {
          if (cancelled) {
            return;
          }

          // Fail-closed: never trust cached role_id/profile when /api/user cannot verify
          // (expired token, network error, or server unavailable → re-login).
          await clearLocalAuth();
        }
      } finally {
        if (!cancelled) {
          setIsRestoring(false);
        }
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [applySession, clearLocalAuth]);

  const login = useCallback(
    async (email: string, password: string): Promise<DashboardRoute> => {
      if (loginInFlight.current) {
        return loginInFlight.current;
      }

      const request = (async () => {
        const result = await authService.login({ email, password });
        if (!result.success || !result.token || !result.user || !result.userProfile) {
          throw new AuthError('LOGIN_FAILED', 'Invalid email or password.');
        }

        applySession(result.token, result.user, result.userProfile);
        await secureAuthStorage.saveSession(result.token, result.userProfile);
        return result.dashboard;
      })();

      loginInFlight.current = request;
      try {
        return await request;
      } finally {
        loginInFlight.current = null;
      }
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const token = authSessionService.getToken();
    await clearLocalAuth();

    if (!token) {
      return;
    }

    try {
      await authService.logout(token);
    } catch {
      // Local auth is already cleared.
    }
  }, [clearLocalAuth]);

  const dashboardRoute = useMemo(
    () => (userProfile ? getDashboardRouteForRole(userProfile.role_id) : null),
    [userProfile],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isRestoring,
      isAuthenticated,
      user,
      userProfile,
      dashboardRoute,
      login,
      logout,
    }),
    [isRestoring, isAuthenticated, user, userProfile, dashboardRoute, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
